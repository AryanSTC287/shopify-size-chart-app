import {
  Page,
  Card,
  Button,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  EmptyState,
  Spinner,
  Stack,
  TextField,
  Divider,
} from "@shopify/polaris";

import { useMemo, useState } from "react";

export default function Products() {
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [loaded, setLoaded] = useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/products",
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (
        !response.ok ||
        !result?.success
      ) {
        throw new Error(
          result?.error ||
            "Failed to fetch products."
        );
      }

      setProducts(
        result?.data?.products || []
      );

      setLoaded(true);
    } catch (error) {
      console.error(
        "Products loading error:",
        error
      );

      setError(
        error?.message ||
          "Failed to load products."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const value = search
      .trim()
      .toLowerCase();

    if (!value) {
      return products;
    }

    return products.filter(
      (product) =>
        product?.title
          ?.toLowerCase()
          .includes(value)
    );
  }, [products, search]);

  function formatPrice(
    amount,
    currency
  ) {
    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {
      return "—";
    }

    try {
      return new Intl.NumberFormat(
        "en-IN",
        {
          style: "currency",
          currency:
            currency || "INR",
          maximumFractionDigits: 2,
        }
      ).format(Number(amount));
    } catch {
      return `${currency || ""} ${amount}`;
    }
  }

  function getStatusTone(status) {
    if (status === "ACTIVE") {
      return "success";
    }

    if (status === "DRAFT") {
      return "attention";
    }

    if (status === "ARCHIVED") {
      return "subdued";
    }

    return undefined;
  }

  return (
    <Page
      title="Products"
      subtitle="View products, prices, and variants from your Shopify store"
    >
      <Stack
        vertical
        spacing="loose"
      >
        <Card>
          <Stack
            alignment="center"
            distribution="equalSpacing"
          >
            <div>
              <Text
                as="h2"
                variant="headingMd"
              >
                Store products
              </Text>

              <div
                style={{
                  marginTop: "6px",
                }}
              >
                <Text
                  as="p"
                  tone="subdued"
                >
                  Load all products
                  currently available
                  in your Shopify
                  store.
                </Text>
              </div>
            </div>

            <Button
              primary
              loading={loading}
              onClick={loadProducts}
            >
              Get products
            </Button>
          </Stack>
        </Card>

        {error && (
          <Card>
            <Stack
              vertical
              spacing="tight"
            >
              <Text
                as="p"
                tone="critical"
              >
                {error}
              </Text>

              <Button
                onClick={loadProducts}
              >
                Try again
              </Button>
            </Stack>
          </Card>
        )}

        {loading && (
          <Card>
            <div
              style={{
                minHeight: 240,
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "center",
              }}
            >
              <Spinner
                accessibilityLabel="Loading products"
                size="large"
              />
            </div>
          </Card>
        )}

        {!loading && loaded && (
          <Card>
            <Stack
              vertical
              spacing="loose"
            >
              <Stack
                alignment="center"
                distribution="equalSpacing"
              >
                <Text
                  as="h2"
                  variant="headingMd"
                >
                  Products
                </Text>

                <Text
                  as="span"
                  tone="subdued"
                >
                  {products.length}{" "}
                  products
                </Text>
              </Stack>

              <TextField
                label="Search products"
                labelHidden
                value={search}
                onChange={setSearch}
                placeholder="Search products by name"
                clearButton
                onClearButtonClick={() =>
                  setSearch("")
                }
                autoComplete="off"
              />

              <Divider />

              {filteredProducts.length ===
              0 ? (
                <EmptyState
                  heading={
                    products.length === 0
                      ? "No products found"
                      : "No matching products"
                  }
                  image=""
                >
                  <Text
                    as="p"
                    tone="subdued"
                  >
                    {products.length ===
                    0
                      ? "There are no products available in your Shopify store."
                      : "Try changing your search."}
                  </Text>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{
                    singular:
                      "product",
                    plural:
                      "products",
                  }}
                  itemCount={
                    filteredProducts.length
                  }
                  headings={[
                    {
                      title:
                        "Product",
                    },
                    {
                      title:
                        "Price",
                    },
                    {
                      title:
                        "Variants",
                    },
                    {
                      title:
                        "Status",
                    },
                  ]}
                  selectable={false}
                >
                  {filteredProducts.map(
                    (
                      product,
                      index
                    ) => (
                      <IndexTable.Row
                        id={
                          product.id
                        }
                        key={
                          product.id
                        }
                        position={
                          index
                        }
                      >
                        <IndexTable.Cell>
                          <Stack
                            alignment="center"
                            spacing="tight"
                          >
                            <Thumbnail
                              source={
                                product.image ||
                                ""
                              }
                              alt={
                                product.imageAlt ||
                                product.title
                              }
                              size="small"
                            />

                            <Text
                              as="span"
                              variant="bodyMd"
                              fontWeight="semibold"
                            >
                              {
                                product.title
                              }
                            </Text>
                          </Stack>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Stack
                            vertical
                            spacing="extraTight"
                          >
                            <Text
                              as="span"
                              variant="bodyMd"
                            >
                              {formatPrice(
                                product.price,
                                product.currencyCode
                              )}
                            </Text>

                            {product.maxPrice !==
                              null &&
                              product.maxPrice !==
                                product.price && (
                                <Text
                                  as="span"
                                  tone="subdued"
                                >
                                  to{" "}
                                  {formatPrice(
                                    product.maxPrice,
                                    product.currencyCode
                                  )}
                                </Text>
                              )}
                          </Stack>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Text as="span">
                            {product
                              .variants
                              ?.length ||
                              0}{" "}
                            variants
                          </Text>
                        </IndexTable.Cell>

                        <IndexTable.Cell>
                          <Badge
                            tone={getStatusTone(
                              product.status
                            )}
                          >
                            {
                              product.status
                            }
                          </Badge>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    )
                  )}
                </IndexTable>
              )}
            </Stack>
          </Card>
        )}

        {!loading &&
          !loaded &&
          !error && (
            <Card>
              <EmptyState
                heading="Ready to load your products"
                image=""
              >
                <Text
                  as="p"
                  tone="subdued"
                >
                  Click "Get products"
                  to retrieve all
                  products from your
                  Shopify store.
                </Text>
              </EmptyState>
            </Card>
          )}
      </Stack>
    </Page>
  );
}