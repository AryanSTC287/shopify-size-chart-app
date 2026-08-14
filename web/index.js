// @ts-check

import { join } from "path";
import { readFileSync } from "fs";
import crypto from "crypto";

import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";

import {
  saveSizeChartToProducts,
  getAssignedSizeChartProducts,
  getProductSizeChart,
  getProductsSizeChartStatus,
  deleteSizeChartFromProduct,
} from "./services/sizeChartShopifyService.js";

const PORT = parseInt(
  process.env.BACKEND_PORT ||
    process.env.PORT ||
    "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV ===
  "production"
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
  "/api/products",
  async (_req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const response =
        await client.request(`
          query GetProducts {
            products(
              first: 100
              sortKey: TITLE
            ) {
              nodes {
                id
                title
                handle
                status

                featuredImage {
                  url
                  altText
                }
              }
            }
          }
        `);

      return res.status(200).json({
        success: true,
        data: {
          products:
            response?.data?.products
              ?.nodes || [],
        },
      });
    } catch (error) {
      console.error(
        "Get products error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to fetch Shopify products.",
      });
    }
  }
);

app.post(
  "/api/products/size-chart-status",
  async (req, res) => {
    try {
      const productIds =
        Array.isArray(
          req.body?.productIds
        )
          ? req.body.productIds
          : [];

      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const products =
        await getProductsSizeChartStatus(
          client,
          productIds
        );

      return res.status(200).json({
        success: true,
        data: {
          products,
        },
      });
    } catch (error) {
      console.error(
        "Product status error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to check product status.",
      });
    }
  }
);

app.get(
  "/api/products/:productId/size-chart",
  async (req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const result =
        await getProductSizeChart(
          client,
          req.params.productId
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          error:
            "Product not found.",
        });
      }

      if (!result.sizeChart) {
        return res.status(404).json({
          success: false,
          error:
            "No Size Chart is assigned to this product.",
        });
      }

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(
        "Get product chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to fetch Size Chart.",
      });
    }
  }
);

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
          query {
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
        "Create product error:",
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

app.post(
  "/api/size-charts",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const {
        title,
        columns,
        rows,
        products,
      } = req.body;

      if (
        !title ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Size chart title is required.",
        });
      }

      if (
        !Array.isArray(
          columns
        ) ||
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
        !Array.isArray(
          products
        ) ||
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
          .map((product) =>
            typeof product ===
            "string"
              ? product
              : product?.id
          )
          .filter(Boolean);

      const client =
        new shopify.api.clients.Graphql({
          session,
        });

      const statuses =
        await getProductsSizeChartStatus(
          client,
          productIds
        );

      const newProducts =
        statuses.filter(
          (item) =>
            !item.assigned
        );

      const existingProducts =
        statuses.filter(
          (item) =>
            item.assigned
        );

      if (
        newProducts.length ===
        0
      ) {
        return res.status(409).json({
          success: false,
          code:
            "PRODUCTS_ALREADY_ASSIGNED",
          error:
            "All selected products already have a Size Chart assigned.",
          data: {
            products:
              existingProducts,
          },
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

      if (
        normalizedColumns.some(
          (column) =>
            !column.name
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Every column must have a name.",
        });
      }

      const normalizedRows =
        rows.map(
          (row, index) => {
            const normalizedRow = {
              id:
                row?.id ||
                `row-${index + 1}`,
            };

            normalizedColumns.forEach(
              (column) => {
                normalizedRow[
                  column.id
                ] =
                  row?.[
                    column.id
                  ] ?? "";
              }
            );

            return normalizedRow;
          }
        );

      const newProductIds =
        newProducts.map(
          (item) => item.id
        );

      const chartId =
        crypto.randomUUID();

      const normalizedProducts =
        products
          .filter((product) =>
            newProductIds.includes(
              product?.id
            )
          )
          .map((product) => ({
            id: product.id,
            title:
              product.title || "",
            handle:
              product.handle || "",
            image:
              product.image ||
              null,
          }));

      const sizeChart = {
        id: chartId,
        title:
          title.trim(),
        columns:
          normalizedColumns,
        rows:
          normalizedRows,
        products:
          normalizedProducts,
      };

      await saveSizeChartToProducts(
        client,
        sizeChart,
        newProductIds
      );

      return res.status(201).json({
        success: true,
        message:
          existingProducts.length >
          0
            ? "Size chart saved for the new products. Existing product assignments were left unchanged."
            : "Size chart saved successfully.",
        data: {
          sizeChart,
          existingProducts,
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

app.get(
  "/api/size-charts/assigned-products",
  async (_req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const assignedProducts =
        await getAssignedSizeChartProducts(
          client
        );

      return res.status(200).json({
        success: true,
        data: {
          assignedProducts,
        },
      });
    } catch (error) {
      console.error(
        "Assigned products error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to fetch assigned products.",
      });
    }
  }
);

app.get(
  "/api/size-charts",
  async (_req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const assignedProducts =
        await getAssignedSizeChartProducts(
          client
        );

      return res.status(200).json({
        success: true,
        data: {
          assignedProducts,
        },
      });
    } catch (error) {
      console.error(
        "Size charts error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to fetch Size Charts.",
      });
    }
  }
);

app.get(
  "/api/size-charts/:id",
  async (req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const assignedProducts =
        await getAssignedSizeChartProducts(
          client
        );

      const match =
        assignedProducts.find(
          (item) =>
            item.sizeChart?.id ===
            req.params.id
        );

      if (!match) {
        return res.status(404).json({
          success: false,
          error:
            "Size chart not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          sizeChart:
            match.sizeChart,
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
          error?.message ||
          "Failed to fetch Size Chart.",
      });
    }
  }
);

app.put(
  "/api/size-charts/:id",
  async (req, res) => {
    try {
      const session =
        res.locals.shopify.session;

      const {
        title,
        columns,
        rows,
      } = req.body;

      if (
        !title ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Size chart title is required.",
        });
      }

      if (
        !Array.isArray(
          columns
        ) ||
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

      const client =
        new shopify.api.clients.Graphql({
          session,
        });

      const assignments =
        await getAssignedSizeChartProducts(
          client
        );

      const matching =
        assignments.filter(
          (item) =>
            item.sizeChart?.id ===
            req.params.id
        );

      if (
        matching.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "Size chart not found.",
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

      if (
        normalizedColumns.some(
          (column) =>
            !column.name
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Every column must have a name.",
        });
      }

      const normalizedRows =
        rows.map(
          (row, index) => {
            const normalizedRow = {
              id:
                row?.id ||
                `row-${index + 1}`,
            };

            normalizedColumns.forEach(
              (column) => {
                normalizedRow[
                  column.id
                ] =
                  row?.[
                    column.id
                  ] ?? "";
              }
            );

            return normalizedRow;
          }
        );

      const updatedChart = {
        id: req.params.id,
        title: title.trim(),
        columns:
          normalizedColumns,
        rows: normalizedRows,
      };

      const productIds =
        matching.map(
          (item) =>
            item.product.id
        );

      await saveSizeChartToProducts(
        client,
        updatedChart,
        productIds
      );

      return res.status(200).json({
        success: true,
        message:
          "Size chart updated successfully.",
        data: {
          sizeChart:
            updatedChart,
        },
      });
    } catch (error) {
      console.error(
        "Update size chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to update Size Chart.",
      });
    }
  }
);

app.delete(
  "/api/size-charts/product/:productId",
  async (req, res) => {
    try {
      const client =
        new shopify.api.clients.Graphql({
          session:
            res.locals.shopify.session,
        });

      const product =
        await getProductSizeChart(
          client,
          req.params.productId
        );

      if (
        !product?.sizeChart
      ) {
        return res.status(404).json({
          success: false,
          error:
            "No Size Chart is assigned to this product.",
        });
      }

      await deleteSizeChartFromProduct(
        client,
        req.params.productId
      );

      return res.status(200).json({
        success: true,
        message:
          "Size chart removed from product.",
      });
    } catch (error) {
      console.error(
        "Remove Size Chart error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error?.message ||
          "Failed to remove Size Chart.",
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