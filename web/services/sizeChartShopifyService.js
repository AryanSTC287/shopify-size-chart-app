const METAFIELD_NAMESPACE = "custom";
const METAFIELD_KEY = "size_chart";
const METAFIELD_TYPE = "json";

const GET_METAFIELD_DEFINITION = `
  query GetSizeChartMetafieldDefinition(
    $namespace: String!
    $key: String!
  ) {
    metafieldDefinitions(
      first: 1
      ownerType: PRODUCT
      namespace: $namespace
      key: $key
    ) {
      nodes {
        id
        name
        namespace
        key
        type {
          name
        }
      }
    }
  }
`;

const CREATE_METAFIELD_DEFINITION = `
  mutation CreateSizeChartMetafieldDefinition(
    $definition: MetafieldDefinitionInput!
  ) {
    metafieldDefinitionCreate(
      definition: $definition
    ) {
      createdDefinition {
        id
        name
        namespace
        key
        type {
          name
        }
      }

      userErrors {
        field
        message
      }
    }
  }
`;

const SET_PRODUCT_METAFIELDS = `
  mutation SetProductSizeChartMetafield(
    $metafields: [MetafieldsSetInput!]!
  ) {
    metafieldsSet(
      metafields: $metafields
    ) {
      metafields {
        id
        namespace
        key
        type
        value
        owner {
          ... on Product {
            id
          }
        }
      }

      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_PRODUCT_METAFIELD = `
  mutation DeleteProductSizeChartMetafield(
    $metafields: [MetafieldIdentifierInput!]!
  ) {
    metafieldsDelete(
      metafields: $metafields
    ) {
      deletedMetafields {
        ownerId
        namespace
        key
      }

      userErrors {
        field
        message
      }
    }
  }
`;

const GET_ASSIGNED_PRODUCTS = `
  query GetAssignedSizeChartProducts {
    products(
      first: 250
      sortKey: TITLE
    ) {
      nodes {
        id
        title
        handle

        featuredImage {
          url
          altText
        }

        metafield(
          namespace: "custom"
          key: "size_chart"
        ) {
          id
          namespace
          key
          type
          value
        }
      }
    }
  }
`;

const GET_PRODUCT_SIZE_CHART = `
  query GetProductSizeChart(
    $id: ID!
  ) {
    product(id: $id) {
      id
      title
      handle

      featuredImage {
        url
        altText
      }

      metafield(
        namespace: "custom"
        key: "size_chart"
      ) {
        id
        namespace
        key
        type
        value
      }
    }
  }
`;

async function requestGraphQL(
  client,
  query,
  variables = {}
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  try {
    const response =
      await client.request(
        query,
        {
          variables,
        }
      );

    if (
      Array.isArray(
        response?.errors
      ) &&
      response.errors.length > 0
    ) {
      const message =
        response.errors
          .map(
            (error) =>
              error?.message ||
              "Shopify GraphQL error."
          )
          .join(", ");

      throw new Error(
        `Shopify GraphQL error: ${message}`
      );
    }

    return (
      response?.data ??
      response
    );
  } catch (error) {
    throw new Error(
      error?.message ||
        "Shopify GraphQL request failed."
    );
  }
}

export async function ensureSizeChartMetafieldDefinition(
  client
) {
  const existingResult =
    await requestGraphQL(
      client,
      GET_METAFIELD_DEFINITION,
      {
        namespace:
          METAFIELD_NAMESPACE,
        key: METAFIELD_KEY,
      }
    );

  const existingDefinition =
    existingResult
      ?.metafieldDefinitions
      ?.nodes?.[0];

  if (existingDefinition) {
    return existingDefinition;
  }

  const createResult =
    await requestGraphQL(
      client,
      CREATE_METAFIELD_DEFINITION,
      {
        definition: {
          name: "Size Chart",
          namespace:
            METAFIELD_NAMESPACE,
          key: METAFIELD_KEY,
          description:
            "Stores the size chart configuration for a product.",
          type: METAFIELD_TYPE,
          ownerType: "PRODUCT",
        },
      }
    );

  const payload =
    createResult
      ?.metafieldDefinitionCreate;

  if (
    payload?.userErrors?.length
  ) {
    const message =
      payload.userErrors
        .map(
          (error) =>
            error.message
        )
        .join(", ");

    throw new Error(
      `Shopify metafield definition error: ${message}`
    );
  }

  if (
    !payload?.createdDefinition
  ) {
    throw new Error(
      "Shopify did not create the Size Chart metafield definition."
    );
  }

  return payload.createdDefinition;
}

export async function getAssignedSizeChartProducts(
  client
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  const result =
    await requestGraphQL(
      client,
      GET_ASSIGNED_PRODUCTS
    );

  const products =
    result?.products?.nodes || [];

  const assignedProducts = [];

  for (const product of products) {
    const value =
      product?.metafield?.value;

    if (!value) {
      continue;
    }

    let sizeChart;

    try {
      sizeChart =
        JSON.parse(value);
    } catch (error) {
      console.error(
        "Invalid Size Chart metafield JSON:",
        product.id,
        error
      );

      continue;
    }

    if (!sizeChart) {
      continue;
    }

    assignedProducts.push({
      product: {
        id: product.id,
        title:
          product.title ||
          "Untitled product",
        handle:
          product.handle || "",
        image:
          product.featuredImage
            ?.url || null,
      },
      sizeChart,
    });
  }

  return assignedProducts;
}

export async function getProductSizeChart(
  client,
  productId
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  if (!productId) {
    throw new Error(
      "Product ID is required."
    );
  }

  const result =
    await requestGraphQL(
      client,
      GET_PRODUCT_SIZE_CHART,
      {
        id: productId,
      }
    );

  const product =
    result?.product;

  if (!product) {
    return null;
  }

  const value =
    product?.metafield?.value;

  if (!value) {
    return {
      product: {
        id: product.id,
        title: product.title,
        handle:
          product.handle || "",
        image:
          product.featuredImage
            ?.url || null,
      },
      sizeChart: null,
    };
  }

  let sizeChart;

  try {
    sizeChart =
      JSON.parse(value);
  } catch (error) {
    throw new Error(
      "The product Size Chart data is invalid."
    );
  }

  return {
    product: {
      id: product.id,
      title: product.title,
      handle:
        product.handle || "",
      image:
        product.featuredImage
          ?.url || null,
    },
    sizeChart,
  };
}

export async function getProductsSizeChartStatus(
  client,
  productIds
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  if (
    !Array.isArray(productIds) ||
    productIds.length === 0
  ) {
    return [];
  }

  const results = [];

  for (const productId of productIds) {
    const result =
      await getProductSizeChart(
        client,
        productId
      );

    results.push({
      id: productId,
      assigned:
        Boolean(
          result?.sizeChart
        ),
      product:
        result?.product ||
        null,
      sizeChart:
        result?.sizeChart ||
        null,
    });
  }

  return results;
}

export async function saveSizeChartToProducts(
  client,
  sizeChart,
  productIds
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  if (
    !Array.isArray(productIds) ||
    productIds.length === 0
  ) {
    throw new Error(
      "No products selected."
    );
  }

  await ensureSizeChartMetafieldDefinition(
    client
  );

  const metafieldValue =
    JSON.stringify({
      id: sizeChart.id,
      title: sizeChart.title,
      columns: sizeChart.columns,
      rows: sizeChart.rows,
    });

  const savedProducts = [];

  for (const productId of productIds) {
    if (!productId) {
      continue;
    }

    const result =
      await requestGraphQL(
        client,
        SET_PRODUCT_METAFIELDS,
        {
          metafields: [
            {
              ownerId: productId,
              namespace:
                METAFIELD_NAMESPACE,
              key: METAFIELD_KEY,
              type: METAFIELD_TYPE,
              value: metafieldValue,
            },
          ],
        }
      );

    const payload =
      result?.metafieldsSet;

    if (
      payload?.userErrors?.length
    ) {
      const message =
        payload.userErrors
          .map(
            (error) =>
              error.message
          )
          .join(", ");

      throw new Error(
        `Failed to save Size Chart to product ${productId}: ${message}`
      );
    }

    if (
      !payload?.metafields?.length
    ) {
      throw new Error(
        `Shopify did not save Size Chart to product ${productId}.`
      );
    }

    savedProducts.push(
      payload.metafields[0]
    );
  }

  return savedProducts;
}

export async function deleteSizeChartFromProduct(
  client,
  productId
) {
  if (!client) {
    throw new Error(
      "Shopify GraphQL client is required."
    );
  }

  if (!productId) {
    throw new Error(
      "Product ID is required."
    );
  }

  const existing =
    await getProductSizeChart(
      client,
      productId
    );

  if (!existing) {
    throw new Error(
      "Product not found."
    );
  }

  if (!existing.sizeChart) {
    throw new Error(
      "No Size Chart is assigned to this product."
    );
  }

  const result =
    await requestGraphQL(
      client,
      DELETE_PRODUCT_METAFIELD,
      {
        metafields: [
          {
            ownerId: productId,
            namespace:
              METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
          },
        ],
      }
    );

  const payload =
    result?.metafieldsDelete;

  if (
    payload?.userErrors?.length
  ) {
    const message =
      payload.userErrors
        .map(
          (error) =>
            error.message
        )
        .join(", ");

    throw new Error(
      `Failed to remove Size Chart from product: ${message}`
    );
  }

  if (
    !Array.isArray(
      payload?.deletedMetafields
    ) ||
    payload.deletedMetafields
      .length === 0
  ) {
    throw new Error(
      "Shopify did not delete the Size Chart metafield from this product."
    );
  }

  const deleted =
    payload.deletedMetafields.some(
      (item) =>
        item.ownerId ===
          productId &&
        item.namespace ===
          METAFIELD_NAMESPACE &&
        item.key ===
          METAFIELD_KEY
    );

  if (!deleted) {
    throw new Error(
      "Shopify did not confirm deletion of the Size Chart metafield."
    );
  }

  return true;
}