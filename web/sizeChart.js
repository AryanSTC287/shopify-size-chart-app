// @ts-check

import { join } from "path";
import { readFileSync } from "fs";

import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";

import {
  createSizeChart,
  getSizeCharts,
  getSizeChartById,
  getSizeChartByProductId,
} from "./models/sizeChartStore.js";

import {
  saveSizeChartToProducts,
  getProductSizeChart,
} from "./services/sizeChartShopifyService.js";

const PORT = parseInt(
  process.env.BACKEND_PORT ||
    process.env.PORT ||
    "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

app.get(
  shopify.config.auth.path,
  shopify.auth.begin()
);

app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({
    webhookHandlers:
      PrivacyWebhookHandlers,
  })
);

app.use(
  shopify.validateAuthenticatedSession()
);

app.use(express.json());

app.get(
  "/api/products/count",
  async (_req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const countData =
        await client.request(`
          query shopifyProductCount {
            productsCount {
              count
            }
          }
        `);

      return res.status(200).json({
        success: true,
        count:
          countData?.data
            ?.productsCount
            ?.count ?? 0,
      });
    } catch (error) {
      console.error(
        "Product count error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch product count.",
      });
    }
  }
);

app.post(
  "/api/products",
  async (_req, res) => {
    try {
      await productCreator(
        res.locals.shopify.session
      );

      return res.status(200).json({
        success: true,
        error: null,
      });
    } catch (error) {
      console.error(
        "Failed to process products/create:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to create product.",
      });
    }
  }
);

/* Create Size Chart */

app.post(
  "/api/size-charts",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const shop = session.shop;

      const {
        title,
        columns,
        rows,
        products,
      } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Size chart title is required.",
        });
      }

      if (
        !Array.isArray(columns) ||
        columns.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "At least one column is required.",
        });
      }

      if (
        !Array.isArray(rows) ||
        rows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "At least one row is required.",
        });
      }

      if (
        !Array.isArray(products) ||
        products.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Please select at least one product.",
        });
      }

      const productIds =
        products
          .map((product) => {
            if (
              typeof product ===
              "string"
            ) {
              return product;
            }

            return product?.id;
          })
          .filter(Boolean);

      if (
        productIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "No valid Shopify product IDs were provided.",
        });
      }

      const normalizedColumns =
        columns.map(
          (column, index) => ({
            id:
              column?.id ||
              `column-${index + 1}`,
            name: String(
              column?.name || ""
            ).trim(),
          })
        );

      const hasInvalidColumn =
        normalizedColumns.some(
          (column) =>
            !column.name
        );

      if (hasInvalidColumn) {
        return res.status(400).json({
          success: false,
          error:
            "Every column must have a name.",
        });
      }

      const normalizedRows =
        rows.map(
          (row, rowIndex) => {
            const normalizedRow = {
              id:
                row?.id ||
                `row-${rowIndex + 1}`,
            };

            for (const column of normalizedColumns) {
              normalizedRow[
                column.id
              ] =
                row?.[
                  column.id
                ] ?? "";
            }

            return normalizedRow;
          }
        );

      const client =
        new shopify.api.clients.Graphql({
          session,
        });

      /*
       * Check Shopify directly before
       * creating the chart.
       */

      for (const productId of productIds) {
        const existing =
          await getProductSizeChart(
            client,
            productId
          );

        if (existing) {
          return res.status(409).json({
            success: false,
            code:
              "SIZE_CHART_ALREADY_ASSIGNED",
            error:
              `Size chart is already assigned to product "${existing.product.title}".`,
            data: {
              product: existing.product,
              sizeChart:
                existing.sizeChart,
            },
          });
        }
      }

      const sizeChart =
        createSizeChart({
          shop,
          title: title.trim(),
          columns:
            normalizedColumns,
          rows: normalizedRows,
          products,
        });

      await saveSizeChartToProducts(
        client,
        {
          id: sizeChart.id,
          title: sizeChart.title,
          columns:
            sizeChart.columns,
          rows: sizeChart.rows,
        },
        productIds
      );

      return res.status(201).json({
        success: true,
        message:
          "Size chart saved successfully.",
        data: {
          sizeChart,
        },
      });
    } catch (error) {
      console.error(
        "Create size chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to save size chart.",
      });
    }
  }
);

/* Get all size charts */

app.get(
  "/api/size-charts",
  async (_req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const shop =
        session.shop;

      const sizeCharts =
        getSizeCharts(shop);

      return res.status(200).json({
        success: true,
        data: {
          sizeCharts,
        },
      });
    } catch (error) {
      console.error(
        "Get size charts error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch size charts.",
      });
    }
  }
);

/* Get size chart by ID */

app.get(
  "/api/size-charts/:id",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const shop =
        session.shop;

      const sizeChart =
        getSizeChartById(
          shop,
          req.params.id
        );

      if (!sizeChart) {
        return res.status(404).json({
          success: false,
          error:
            "Size chart not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          sizeChart,
        },
      });
    } catch (error) {
      console.error(
        "Get size chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to fetch size chart.",
      });
    }
  }
);

/*
 * Get size chart assigned to
 * one Shopify product.
 */

app.get(
  "/api/products/:productId/size-chart",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const client =
        new shopify.api.clients.Graphql({
          session,
        });

      const result =
        await getProductSizeChart(
          client,
          req.params.productId
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          code:
            "SIZE_CHART_NOT_ASSIGNED",
          error:
            "No size chart is assigned to this product.",
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Get product size chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to fetch product size chart.",
      });
    }
  }
);

/*
 * Check multiple products.
 *
 * This is used by the Add Product
 * screen to know which products
 * already have a size chart.
 */

app.post(
  "/api/products/size-charts/check",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const client =
        new shopify.api.clients.Graphql({
          session,
        });

      const productIds =
        Array.isArray(
          req.body?.productIds
        )
          ? req.body.productIds
          : [];

      if (
        productIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Product IDs are required.",
        });
      }

      const results = [];

      for (const productId of productIds) {
        const result =
          await getProductSizeChart(
            client,
            productId
          );

        results.push({
          productId,
          assigned: Boolean(result),
          product: result?.product || null,
          sizeChart:
            result?.sizeChart || null,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          products: results,
        },
      });
    } catch (error) {
      console.error(
        "Check product size charts error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to check product size charts.",
      });
    }
  }
);

app.use(
  shopify.cspHeaders()
);

app.use(
  serveStatic(STATIC_PATH, {
    index: false,
  })
);

app.use(
  "/*",
  shopify.ensureInstalledOnShop(),
  async (_req, res) => {
    return res
      .status(200)
      .set(
        "Content-Type",
        "text/html"
      )
      .send(
        readFileSync(
          join(
            STATIC_PATH,
            "index.html"
          )
        )
          .toString()
          .replace(
            "%VITE_SHOPIFY_API_KEY%",
            process.env
              .SHOPIFY_API_KEY || ""
          )
      );
  }
);

app.listen(PORT, () => {
  console.log(
    `Size Chart app running on port ${PORT}`
  );
});