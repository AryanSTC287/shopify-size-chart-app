import { useEffect, useState } from "react";
import {
  Banner,
  Button,
  Card,
  Modal,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

const API_BASE_URL = "/api";

const DEFAULT_COLUMNS = [
  {
    id: "size",
    name: "Size",
  },
  {
    id: "chest",
    name: "Chest (in)",
  },
  {
    id: "waist",
    name: "Waist (in)",
  },
  {
    id: "length",
    name: "Length (in)",
  },
];

const DEFAULT_ROWS = [
  {
    id: "row-1",
    size: "S",
    chest: "36",
    waist: "30",
    length: "27",
  },
  {
    id: "row-2",
    size: "M",
    chest: "38",
    waist: "32",
    length: "28",
  },
  {
    id: "row-3",
    size: "L",
    chest: "40",
    waist: "34",
    length: "29",
  },
  {
    id: "row-4",
    size: "XL",
    chest: "42",
    waist: "36",
    length: "30",
  },
];

const cloneDefaultColumns = () =>
  DEFAULT_COLUMNS.map((column) => ({
    ...column,
  }));

const cloneDefaultRows = () =>
  DEFAULT_ROWS.map((row) => ({
    ...row,
  }));

const createRow = (columns) => {
  const row = {};

  columns.forEach((column) => {
    row[column.id] = "";
  });

  return row;
};

const createColumn = (index) => ({
  id: `column-${Date.now()}-${index}`,
  name: `Column ${index + 1}`,
});

const normalizeProduct = (product) => ({
  id: product?.id,
  title: product?.title || "Untitled product",
  handle: product?.handle || "",
  image:
    product?.images?.[0]?.originalSrc ||
    product?.images?.[0]?.url ||
    product?.featuredImage?.url ||
    product?.image ||
    null,
});

const normalizeOperationProducts = (products) => {
  if (!Array.isArray(products)) {
    return [];
  }

  return products.map((item) => ({
    id:
      item?.id ||
      item?.productId ||
      item?.product?.id ||
      null,

    title:
      item?.title ||
      item?.productTitle ||
      item?.product?.title ||
      "Untitled product",

    error:
      item?.error ||
      item?.message ||
      item?.reason ||
      "This product already has a Size Chart assigned.",
     }));
     };

export default function SizeChart() {
  const shopify = useAppBridge();

  const [chartName, setChartName] =
    useState("");

  const [columns, setColumns] =
    useState(cloneDefaultColumns);

  const [rows, setRows] =
    useState(cloneDefaultRows);

  const [selectedProducts, setSelectedProducts] =
    useState([]);

  const [assignedProducts, setAssignedProducts] =
    useState([]);

  const [loadingAssigned, setLoadingAssigned] =
    useState(false);

  const [openingPicker, setOpeningPicker] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [duplicateProduct, setDuplicateProduct] =
    useState(null);

  const [viewChart, setViewChart] =
    useState(null);

  const [actionProduct, setActionProduct] =
    useState(null);

  const [actionType, setActionType] =
    useState(null);

  const [editingChartId, setEditingChartId] =
    useState(null);

  const [partialResult, setPartialResult] =
    useState(null);

  const [showRejectedProducts, setShowRejectedProducts] =
    useState(false);

  const canDeleteColumn =
    columns.length > 1;

  const canDeleteRow =
    rows.length > 1;

  useEffect(() => {
    loadAssignedProducts();
  }, []);

  const loadAssignedProducts =
    async () => {
      setLoadingAssigned(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/size-charts/assigned-products`,
            {
              method: "GET",
              credentials: "include",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              result.message ||
              "Failed to load assigned products."
          );
        }

        setAssignedProducts(
          result.data?.assignedProducts ||
            []
        );
      } catch (err) {
        console.error(
          "Load assigned products error:",
          err
        );

        setError(
          err?.message ||
            "Failed to load assigned products."
        );
      } finally {
        setLoadingAssigned(false);
      }
    };

  const updateColumnName = (
    columnId,
    value
  ) => {
    setColumns(
      (currentColumns) =>
        currentColumns.map(
          (column) =>
            column.id === columnId
              ? {
                  ...column,
                  name: value,
                }
              : column
        )
    );
  };

  const updateCell = (
    rowId,
    columnId,
    value
  ) => {
    setRows(
      (currentRows) =>
        currentRows.map(
          (row) =>
            row.id === rowId
              ? {
                  ...row,
                  [columnId]: value,
                }
              : row
        )
    );
  };

  const addRow = () => {
    setRows(
      (currentRows) => [
        ...currentRows,
        {
          id: `row-${Date.now()}`,
          ...createRow(columns),
        },
      ]
    );
  };

  const deleteRow = (
    rowId
  ) => {
    if (!canDeleteRow) {
      return;
    }

    setRows(
      (currentRows) =>
        currentRows.filter(
          (row) =>
            row.id !== rowId
        )
    );
  };

  const addColumn = () => {
    const newColumn =
      createColumn(
        columns.length
      );

    setColumns(
      (currentColumns) => [
        ...currentColumns,
        newColumn,
      ]
    );

    setRows(
      (currentRows) =>
        currentRows.map(
          (row) => ({
            ...row,
            [newColumn.id]: "",
          })
        )
    );
  };

  const deleteColumn = (
    columnId
  ) => {
    if (!canDeleteColumn) {
      return;
    }

    setColumns(
      (currentColumns) =>
        currentColumns.filter(
          (column) =>
            column.id !== columnId
        )
    );

    setRows(
      (currentRows) =>
        currentRows.map(
          (row) => {
            const updatedRow = {
              ...row,
            };

            delete updatedRow[
              columnId
            ];

            return updatedRow;
          }
        )
    );
  };

  const checkProductStatuses =
    async (products) => {
      if (
        !Array.isArray(
          products
        ) ||
        products.length === 0
      ) {
        return [];
      }

      const response =
        await fetch(
          `${API_BASE_URL}/products/size-chart-status`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials:
              "include",
            body: JSON.stringify({
              productIds:
                products.map(
                  (product) =>
                    product.id
                ),
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            result.message ||
            "Failed to check product status."
        );
      }

      return (
        result.data?.products ||
        []
      );
    };

  const openProductPicker =
    async () => {
      setError("");
      setSuccess("");
      setPartialResult(null);
      setShowRejectedProducts(false);
      setOpeningPicker(true);

      try {
        if (
          !shopify ||
          typeof shopify.resourcePicker !==
            "function"
        ) {
          throw new Error(
            "Shopify product picker is not available."
          );
        }

        const selection =
          await shopify.resourcePicker(
            {
              type: "product",
              action: "select",
              multiple: true,
              filter: {
                archived:
                  false,
                draft:
                  false,
                query:
                  "",
              },
            }
          );

        if (
          !selection ||
          selection.length === 0
        ) {
          return;
        }

        const pickedProducts =
          selection
            .map(
              normalizeProduct
            )
            .filter(
              (product) =>
                product.id
            );

        const alreadySelected =
          pickedProducts.filter(
            (product) =>
              selectedProducts.some(
                (item) =>
                  item.id ===
                  product.id
              )
          );

        const productsToCheck =
          pickedProducts.filter(
            (product) =>
              !selectedProducts.some(
                (item) =>
                  item.id ===
                  product.id
              )
          );

        if (
          alreadySelected.length >
          0
        ) {
          setError(
            alreadySelected.length ===
              1
              ? `${alreadySelected[0].title} is already selected.`
              : "One or more selected products are already in the list."
          );
        }

        if (
          productsToCheck.length ===
          0
        ) {
          return;
        }

        const statusResults =
          await checkProductStatuses(
            productsToCheck
          );

        const statusMap =
          new Map(
            statusResults.map(
              (item) => [
                item.id,
                item,
              ]
            )
          );

        const nextProducts =
          productsToCheck.map(
            (product) => {
              const status =
                statusMap.get(
                  product.id
                );

              return {
                ...product,

                status:
                  status?.assigned
                    ? "data_exists"
                    : "new",

                existingChart:
                  status?.sizeChart ||
                  null,
              };
            }
          );

        const existingAssignments =
          nextProducts.filter(
            (product) =>
              product.status ===
              "data_exists"
          );

        if (
          existingAssignments.length >
          0
        ) {
          setDuplicateProduct({
            product:
              existingAssignments[0],
            sizeChart:
              existingAssignments[0]
                .existingChart,
          });
        }

        setSelectedProducts(
          (currentProducts) => [
            ...currentProducts,
            ...nextProducts,
          ]
        );
      } catch (err) {
        console.error(
          "Product picker error:",
          err
        );

        setError(
          err?.message ||
            "Unable to select Shopify products."
        );
      } finally {
        setOpeningPicker(false);
      }
    };

  const removeSelectedProduct = (
    productId
  ) => {
    setSelectedProducts(
      (currentProducts) =>
        currentProducts.filter(
          (product) =>
            product.id !==
            productId
        )
    );
  };

  const validateForm =
    () => {
      if (
        !chartName.trim()
      ) {
        return "Please enter a size chart title.";
      }

      if (
        columns.length ===
        0
      ) {
        return "Please add at least one column.";
      }

      if (
        columns.some(
          (column) =>
            !column.name.trim()
        )
      ) {
        return "Please enter a name for every column.";
      }

      if (
        rows.length ===
        0
      ) {
        return "Please add at least one row.";
      }

      const newProducts =
        selectedProducts.filter(
          (product) =>
            product.status ===
            "new"
        );

      if (
        newProducts.length ===
        0
      ) {
        return "Please select at least one new product.";
      }

      return "";
    };

  const resetForm = () => {
    setChartName("");

    setColumns(
      cloneDefaultColumns()
    );

    setRows(
      cloneDefaultRows()
    );

    setSelectedProducts(
      []
    );

    setEditingChartId(
      null
    );

    setPartialResult(
      null
    );

    setShowRejectedProducts(
      false
    );
  };

  const buildRejectedProducts =
    (products) => {
      if (
        !Array.isArray(products)
      ) {
        return [];
      }

      return products
        .filter(
          (product) =>
            product.status ===
            "data_exists"
        )
        .map(
          (product) => ({
            id: product.id,

            title:
              product.title ||
              "Untitled product",

            image:
              product.image ||
              null,

            reason:
              "This product already has a Size Chart assigned.",

            existingChart:
              product.existingChart ||
              null,
          })
        );
    };

  const handleSave =
    async () => {
      setError("");
      setSuccess("");
      setPartialResult(null);
      setShowRejectedProducts(false);

      const validationError =
        validateForm();

      if (
        validationError
      ) {
        setError(
          validationError
        );
        return;
      }

      setSaving(true);

      try {
        const productsBeforeSave =
          [...selectedProducts];

        const newProducts =
          productsBeforeSave.filter(
            (product) =>
              product.status ===
              "new"
          );

        const rejectedProducts =
          buildRejectedProducts(
            productsBeforeSave
          );

        const payload = {
          title:
            chartName.trim(),

          columns:
            columns.map(
              (column) => ({
                id: column.id,
                name:
                  column.name.trim(),
              })
            ),

          rows:
            rows.map((row) => {
              const normalizedRow = {
                id: row.id,
              };

              columns.forEach(
                (column) => {
                  normalizedRow[
                    column.id
                  ] =
                    row[
                      column.id
                    ] ??
                    "";
                }
              );

              return normalizedRow;
            }),

          products:
            newProducts.map(
              (product) => ({
                id: product.id,
                title:
                  product.title,
                handle:
                  product.handle,
                image:
                  product.image,
              })
            ),
        };

        const endpoint =
          editingChartId
            ? `${API_BASE_URL}/size-charts/${editingChartId}`
            : `${API_BASE_URL}/size-charts`;

        const method =
          editingChartId
            ? "PUT"
            : "POST";

        const response =
          await fetch(
            endpoint,
            {
              method,
              headers: {
                "Content-Type":
                  "application/json",
              },
              credentials:
                "include",
              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response.json();

        const responseData =
          result?.data || {};

        const successfulProducts =
          normalizeOperationProducts(
            responseData.successfulProducts ||
              responseData.succeededProducts ||
              responseData.successful ||
              result?.successfulProducts
          );

        const failedProducts =
  normalizeOperationProducts(
    responseData.failedProducts ||
      responseData.failed ||
      responseData.existingProducts ||
      result?.failedProducts ||
      []
       ).map((product) => ({
        ...product,
        error:
        product.error ||
        "This product already has a Size Chart assigned.",
       }));

        const successCount =
          Number.isFinite(
            Number(
              responseData.successCount
            )
          )
            ? Number(
                responseData.successCount
              )
            : successfulProducts.length ||
              (
                response.ok &&
                result.success
                  ? newProducts.length
                  : 0
              );

        let finalFailedProducts =
          failedProducts;

        if (
          rejectedProducts.length >
          0
        ) {
          const existingIds =
            new Set(
              finalFailedProducts.map(
                (product) =>
                  product.id
              )
            );

          const rejectedToAdd =
            rejectedProducts.filter(
              (product) =>
                !existingIds.has(
                  product.id
                )
            );

          finalFailedProducts = [
            ...finalFailedProducts,
            ...rejectedToAdd,
          ];
        }

        const failureCount =
          finalFailedProducts.length;

        const partialSuccess =
          successCount > 0 &&
          failureCount > 0;

        if (
          !response.ok ||
          !result.success
        ) {
          if (
            successCount > 0 ||
            failureCount > 0
          ) {
            setPartialResult({
              successCount,
              failureCount,
              successfulProducts,
              failedProducts:
                finalFailedProducts,
            });

            if (
              successCount > 0
            ) {
              setSuccess(
                `${successCount} product${
                  successCount ===
                  1
                    ? ""
                    : "s"
                } updated successfully.${
                  failureCount > 0
                    ? ` ${failureCount} product${
                        failureCount ===
                        1
                          ? ""
                          : "s"
                      } rejected.`
                    : ""
                }`
              );
            }

            if (
              failureCount > 0
            ) {
              setError(
                result.error ||
                  result.message ||
                  "Some products could not be updated."
              );
            }

            if (
              successCount > 0
            ) {
              resetForm();
              await loadAssignedProducts();
            }

            return;
          }

          throw new Error(
            result.error ||
              result.message ||
              "Failed to save size chart."
          );
        }

        if (
          partialSuccess ||
          failureCount > 0
        ) {
          setPartialResult({
            successCount,
            failureCount,
            successfulProducts,
            failedProducts:
              finalFailedProducts,
          });

          setSuccess(
            `${successCount} product${
              successCount === 1
                ? ""
                : "s"
            } updated successfully.${
              failureCount > 0
                ? ` ${failureCount} product${
                    failureCount === 1
                      ? ""
                      : "s"
                  } rejected.`
                : ""
            }`
          );
        } else {
          const totalSaved =
            successCount ||
            newProducts.length;

          setSuccess(
            result.message ||
              `Size chart saved successfully to ${totalSaved} product${
                totalSaved === 1
                  ? ""
                  : "s"
              }.`
          );
        }

        resetForm();

        await loadAssignedProducts();
      } catch (err) {
        console.error(
          "Save size chart error:",
          err
        );

        setError(
          err?.message ||
            "Failed to save size chart."
        );
      } finally {
        setSaving(false);
      }
    };

  const openView =
    (assignment) => {
      if (
        !assignment?.sizeChart
      ) {
        return;
      }

      setViewChart(
        assignment.sizeChart
      );
    };

  const startEdit =
    (assignment) => {
      setActionProduct(
        assignment
      );

      setActionType(
        "edit"
      );
    };

  const confirmEdit =
    async () => {
      if (
        !actionProduct
      ) {
        return;
      }

      const chart =
        actionProduct.sizeChart;

      if (!chart) {
        setActionProduct(
          null
        );

        setActionType(
          null
        );

        return;
      }

      setChartName(
        chart.title || ""
      );

      setColumns(
        Array.isArray(
          chart.columns
        )
          ? chart.columns.map(
              (column) => ({
                ...column,
              })
            )
          : []
      );

      setRows(
        Array.isArray(
          chart.rows
        )
          ? chart.rows.map(
              (row) => ({
                ...row,
              })
            )
          : []
      );

      setSelectedProducts([
        {
          ...actionProduct.product,
          status: "new",
          existingChart:
            null,
        },
      ]);

      setEditingChartId(
        chart.id
      );

      setActionProduct(
        null
      );

      setActionType(
        null
      );

      setSuccess(
        "Size chart loaded for editing."
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const startRemove =
    (assignment) => {
      setActionProduct(
        assignment
      );

      setActionType(
        "remove"
      );
    };

  const confirmRemove =
    async () => {
      if (
        !actionProduct
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setPartialResult(null);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/size-charts/product/${encodeURIComponent(
              actionProduct.product.id
            )}`,
            {
              method:
                "DELETE",
              credentials:
                "include",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              result.message ||
              "Failed to remove Size Chart."
          );
        }

        setActionProduct(
          null
        );

        setActionType(
          null
        );

        setSuccess(
          result.message ||
            "Size chart removed from product."
        );

        await loadAssignedProducts();
      } catch (err) {
        console.error(
          "Remove Size Chart error:",
          err
        );

        setError(
          err?.message ||
            "Failed to remove Size Chart."
        );
      }
    };

  const openRejectedProducts =
    () => {
      setShowRejectedProducts(
        true
      );
    };

  return (
    <Page
      title="Size Chart"
      subtitle="Create a size chart and assign it to Shopify products."
      primaryAction={{
        content:
          saving
            ? "Saving..."
            : editingChartId
            ? "Update Size Chart"
            : "Save Size Chart",

        onAction:
          handleSave,

        loading:
          saving,

        disabled:
          saving,
      }}
      secondaryActions={
        editingChartId
          ? [
              {
                content:
                  "Cancel Edit",
                onAction:
                  resetForm,
              },
            ]
          : []
      }
    >
      <div
        style={{
          display:
            "flex",
          flexDirection:
            "column",
          gap:
            "20px",
          paddingBottom:
            "40px",
        }}
      >
        {error && (
          <Banner
            status="critical"
            onDismiss={() =>
              setError("")
            }
          >
            {error}
          </Banner>
        )}

        {success && (
          <Banner
            status="success"
            onDismiss={() =>
              setSuccess("")
            }
          >
            {success}
          </Banner>
        )}

        {partialResult && (
          <Card>
            <div
              style={{
                padding:
                  "20px",
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "16px",
              }}
            >
              <Text
                variant="headingMd"
                as="h2"
              >
                Save Result
              </Text>

              <Text as="p">
                {partialResult.successCount}{" "}
                product
                {partialResult.successCount ===
                1
                  ? ""
                  : "s"}{" "}
                updated successfully.
              </Text>

              {partialResult.failureCount >
                0 && (
                <Text
                  as="p"
                  tone="critical"
                >
                  {partialResult.failureCount}{" "}
                  product
                  {partialResult.failureCount ===
                  1
                    ? ""
                    : "s"}{" "}
                  rejected.
                </Text>
              )}

              {partialResult.successfulProducts
                .length > 0 && (
                <div>
                  <Text
                    variant="headingSm"
                    as="h3"
                  >
                    Successfully updated
                  </Text>

                  <div
                    style={{
                      marginTop:
                        "8px",
                    }}
                  >
                    {partialResult.successfulProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <Text
                          key={
                            product.id ||
                            index
                          }
                          as="p"
                        >
                          ✓{" "}
                          {
                            product.title
                          }
                        </Text>
                      )
                    )}
                  </div>
                </div>
              )}

              {partialResult.failedProducts
                .length > 0 && (
                <div>
                  <Text
                    variant="headingSm"
                    as="h3"
                  >
                    Rejected products
                  </Text>

                  <div
                    style={{
                      marginTop:
                        "8px",
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap:
                        "8px",
                    }}
                  >
                    {partialResult.failedProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <div
                          key={
                            product.id ||
                            index
                          }
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap:
                              "12px",
                            padding:
                              "10px 12px",
                            border:
                              "1px solid #e1e3e5",
                            borderRadius:
                              "6px",
                          }}
                        >
                          <div>
                            <Text
                              as="p"
                              tone="critical"
                            >
                              ✗{" "}
                              {
                                product.title
                              }
                            </Text>

                            {product.error && (
                              <Text
                                as="p"
                                variant="bodySm"
                                tone="subdued"
                              >
                                {
                                  product.error
                                }
                              </Text>
                            )}
                          </div>

                          {product.existingChart && (
                            <Button
                              variant="plain"
                              onClick={() =>
                                setViewChart(
                                  product.existingChart
                                )
                              }
                            >
                              View chart
                            </Button>
                          )}
                        </div>
                      )
                    )}
                  </div>

                  <div
                    style={{
                      marginTop:
                        "12px",
                    }}
                  >
                    <Button
                      onClick={
                        openRejectedProducts
                      }
                    >
                      View rejected products
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div
            style={{
              padding:
                "20px",
              display:
                "flex",
              flexDirection:
                "column",
              gap:
                "16px",
            }}
          >
            <Text
              variant="headingMd"
              as="h2"
            >
              Chart Details
            </Text>

            <TextField
              label="Chart Title"
              value={
                chartName
              }
              onChange={
                setChartName
              }
              placeholder="Enter title"
              autoComplete="off"
            />
          </div>
        </Card>

        <Card>
          <div
            style={{
              padding:
                "20px",
              display:
                "flex",
              flexDirection:
                "column",
              gap:
                "16px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "12px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <Text
                  variant="headingMd"
                  as="h2"
                >
                  Size Chart
                </Text>

                <Text
                  tone="subdued"
                  as="p"
                >
                  Add rows and columns to build your size chart.
                </Text>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap:
                    "8px",
                }}
              >
                <Button
                  onClick={
                    addRow
                  }
                >
                  Add row
                </Button>

                <Button
                  onClick={
                    addColumn
                  }
                >
                  Add column
                </Button>
              </div>
            </div>

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                  minWidth:
                    "760px",
                }}
              >
                <thead>
                  <tr>
                    {columns.map(
                      (
                        column
                      ) => (
                        <th
                          key={
                            column.id
                          }
                          style={{
                            padding:
                              "12px",
                            border:
                              "1px solid #e1e3e5",
                            background:
                              "#f6f6f7",
                            minWidth:
                              "150px",
                            textAlign:
                              "left",
                            verticalAlign:
                              "top",
                          }}
                        >
                          <TextField
                            label="Column name"
                            labelHidden
                            value={
                              column.name
                            }
                            onChange={(
                              value
                            ) =>
                              updateColumnName(
                                column.id,
                                value
                              )
                            }
                            autoComplete="off"
                          />

                          <div
                            style={{
                              marginTop:
                                "8px",
                            }}
                          >
                            <Button
                              tone="critical"
                              variant="plain"
                              disabled={
                                !canDeleteColumn
                              }
                              onClick={() =>
                                deleteColumn(
                                  column.id
                                )
                              }
                            >
                              Delete column
                            </Button>
                          </div>
                        </th>
                      )
                    )}

                    <th
                      style={{
                        padding:
                          "12px",
                        border:
                          "1px solid #e1e3e5",
                        background:
                          "#f6f6f7",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map(
                    (row) => (
                      <tr
                        key={
                          row.id
                        }
                      >
                        {columns.map(
                          (
                            column
                          ) => (
                            <td
                              key={
                                column.id
                              }
                              style={{
                                padding:
                                  "12px",
                                border:
                                  "1px solid #e1e3e5",
                              }}
                            >
                              <TextField
                                label={
                                  column.name
                                }
                                labelHidden
                                value={
                                  row[
                                    column.id
                                  ] ||
                                  ""
                                }
                                onChange={(
                                  value
                                ) =>
                                  updateCell(
                                    row.id,
                                    column.id,
                                    value
                                  )
                                }
                                autoComplete="off"
                              />
                            </td>
                          )
                        )}

                        <td
                          style={{
                            padding:
                              "12px",
                            border:
                              "1px solid #e1e3e5",
                          }}
                        >
                          <Button
                            tone="critical"
                            variant="plain"
                            disabled={
                              !canDeleteRow
                            }
                            onClick={() =>
                              deleteRow(
                                row.id
                              )
                            }
                          >
                            Delete row
                          </Button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card>
          <div
            style={{
              padding:
                "20px",
              display:
                "flex",
              flexDirection:
                "column",
              gap:
                "16px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "12px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <Text
                  variant="headingMd"
                  as="h2"
                >
                  Add Products
                </Text>

                <Text
                  tone="subdued"
                  as="p"
                >
                  Select products for this size chart.
                </Text>
              </div>

              <Button
                onClick={
                  openProductPicker
                }
                loading={
                  openingPicker
                }
                disabled={
                  openingPicker
                }
              >
                Add product
              </Button>
            </div>

            {selectedProducts.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "32px",
                  textAlign:
                    "center",
                  border:
                    "1px dashed #c9cccf",
                  borderRadius:
                    "8px",
                }}
              >
                <Text
                  tone="subdued"
                  as="p"
                >
                  No products selected.
                </Text>
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                  border:
                    "1px solid #e1e3e5",
                  borderRadius:
                    "8px",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",
                    borderCollapse:
                      "collapse",
                    minWidth:
                      "750px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "left",
                        }}
                      >
                        Product
                      </th>

                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "left",
                        }}
                      >
                        Status
                      </th>

                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "right",
                        }}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedProducts.map(
                      (
                        product
                      ) => (
                        <tr
                          key={
                            product.id
                          }
                        >
                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap:
                                  "12px",
                              }}
                            >
                              {product.image && (
                                <img
                                  src={
                                    product.image
                                  }
                                  alt=""
                                  width="48"
                                  height="48"
                                  style={{
                                    objectFit:
                                      "cover",
                                    borderRadius:
                                      "6px",
                                  }}
                                />
                              )}

                              <div>
                                <Text
                                  as="p"
                                >
                                  {
                                    product.title
                                  }
                                </Text>

                                {product.handle && (
                                  <Text
                                    as="p"
                                    variant="bodySm"
                                    tone="subdued"
                                  >
                                    /
                                    {
                                      product.handle
                                    }
                                  </Text>
                                )}
                              </div>
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                            }}
                          >
                            <Text
                              as="span"
                              tone={
                                product.status ===
                                "data_exists"
                                  ? "critical"
                                  : "success"
                              }
                            >
                              {product.status ===
                              "data_exists"
                                ? "Data exists"
                                : "New"}
                            </Text>
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                              textAlign:
                                "right",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "flex-end",
                                gap:
                                  "8px",
                              }}
                            >
                              {product.status ===
                                "data_exists" &&
                                product.existingChart && (
                                  <Button
                                    variant="plain"
                                    onClick={() =>
                                      setViewChart(
                                        product.existingChart
                                      )
                                    }
                                  >
                                    View
                                  </Button>
                                )}

                              <Button
                                tone="critical"
                                variant="plain"
                                onClick={() =>
                                  removeSelectedProduct(
                                    product.id
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div
            style={{
              padding:
                "20px",
              display:
                "flex",
              flexDirection:
                "column",
              gap:
                "16px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap:
                  "12px",
              }}
            >
              <div>
                <Text
                  variant="headingMd"
                  as="h2"
                >
                  Assigned Products
                </Text>

                <Text
                  tone="subdued"
                  as="p"
                >
                  Products that already have a size chart assigned.
                </Text>
              </div>

              <Button
                onClick={
                  loadAssignedProducts
                }
                loading={
                  loadingAssigned
                }
              >
                Refresh
              </Button>
            </div>

            {loadingAssigned ? (
              <div
                style={{
                  padding:
                    "30px",
                  textAlign:
                    "center",
                }}
              >
                <Text
                  tone="subdued"
                  as="p"
                >
                  Loading assigned products...
                </Text>
              </div>
            ) : assignedProducts.length ===
              0 ? (
              <div
                style={{
                  padding:
                    "30px",
                  textAlign:
                    "center",
                  border:
                    "1px dashed #c9cccf",
                  borderRadius:
                    "8px",
                }}
              >
                <Text
                  tone="subdued"
                  as="p"
                >
                  No products are assigned yet.
                </Text>
              </div>
            ) : (
              <div
                style={{
                  overflowX:
                    "auto",
                  border:
                    "1px solid #e1e3e5",
                  borderRadius:
                    "8px",
                }}
              >
                <table
                  style={{
                    width:
                      "100%",
                    borderCollapse:
                      "collapse",
                    minWidth:
                      "700px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "left",
                        }}
                      >
                        Product
                      </th>

                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "left",
                        }}
                      >
                        Size Chart
                      </th>

                      <th
                        style={{
                          padding:
                            "14px 16px",
                          background:
                            "#f6f6f7",
                          borderBottom:
                            "1px solid #e1e3e5",
                          textAlign:
                            "right",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignedProducts.map(
                      (
                        assignment
                      ) => (
                        <tr
                          key={`${assignment.product.id}-${assignment.sizeChart.id}`}
                        >
                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap:
                                  "12px",
                              }}
                            >
                              {assignment
                                .product
                                .image && (
                                <img
                                  src={
                                    assignment
                                      .product
                                      .image
                                  }
                                  alt=""
                                  width="48"
                                  height="48"
                                  style={{
                                    objectFit:
                                      "cover",
                                    borderRadius:
                                      "6px",
                                  }}
                                />
                              )}

                              <div>
                                <Text
                                  as="p"
                                >
                                  {
                                    assignment
                                      .product
                                      .title
                                  }
                                </Text>

                                {assignment
                                  .product
                                  .handle && (
                                  <Text
                                    as="p"
                                    variant="bodySm"
                                    tone="subdued"
                                  >
                                    /
                                    {
                                      assignment
                                        .product
                                        .handle
                                    }
                                  </Text>
                                )}
                              </div>
                            </div>
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                            }}
                          >
                            <Text
                              as="span"
                            >
                              {
                                assignment
                                  .sizeChart
                                  .title
                              }
                            </Text>
                          </td>

                          <td
                            style={{
                              padding:
                                "14px 16px",
                              borderBottom:
                                "1px solid #e1e3e5",
                              textAlign:
                                "right",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "flex-end",
                                gap:
                                  "8px",
                              }}
                            >
                              <Button
                                variant="plain"
                                onClick={() =>
                                  openView(
                                    assignment
                                  )
                                }
                              >
                                View
                              </Button>

                              <Button
                                variant="plain"
                                onClick={() =>
                                  startEdit(
                                    assignment
                                  )
                                }
                              >
                                Edit
                              </Button>

                              <Button
                                tone="critical"
                                variant="plain"
                                onClick={() =>
                                  startRemove(
                                    assignment
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={Boolean(
          duplicateProduct
        )}
        onClose={() =>
          setDuplicateProduct(
            null
          )
        }
        title="Product already assigned"
        primaryAction={{
          content:
            "View Size Chart",
          onAction: () => {
            setViewChart(
              duplicateProduct
                ?.sizeChart ||
                null
            );

            setDuplicateProduct(
              null
            );
          },
        }}
        secondaryActions={[
          {
            content: "Close",
            onAction: () =>
              setDuplicateProduct(
                null
              ),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            <strong>
              {
                duplicateProduct
                  ?.product
                  ?.title
              }
            </strong>{" "}
            is already assigned to a Size Chart.
          </Text>

          <div
            style={{
              marginTop:
                "12px",
            }}
          >
            <Text
              tone="subdued"
              as="p"
            >
              This product will be rejected and its existing Size Chart will not be overwritten.
            </Text>
          </div>
        </Modal.Section>
      </Modal>

      <Modal
        open={
          showRejectedProducts
        }
        onClose={() =>
          setShowRejectedProducts(
            false
          )
        }
        title="Rejected products"
        primaryAction={{
          content:
            "Close",
          onAction: () =>
            setShowRejectedProducts(
              false
            ),
        }}
        large
      >
        <Modal.Section>
          {partialResult?.failedProducts
            ?.length > 0 ? (
            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                gap:
                  "16px",
              }}
            >
              <Text as="p">
                These products were not assigned because they already have a Size Chart.
              </Text>

              {partialResult.failedProducts.map(
                (
                  product,
                  index
                ) => (
                  <div
                    key={
                      product.id ||
                      index
                    }
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap:
                        "16px",
                      padding:
                        "14px",
                      border:
                        "1px solid #e1e3e5",
                      borderRadius:
                        "8px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "12px",
                      }}
                    >
                      {product.image && (
                        <img
                          src={
                            product.image
                          }
                          alt=""
                          width="48"
                          height="48"
                          style={{
                            objectFit:
                              "cover",
                            borderRadius:
                              "6px",
                          }}
                        />
                      )}

                      <div>
                        <Text
                          as="p"
                          fontWeight="semibold"
                        >
                          {
                            product.title
                          }
                        </Text>

                        <div
                          style={{
                            marginTop:
                              "4px",
                          }}
                        >
                          <Text
                            as="p"
                            variant="bodySm"
                            tone="critical"
                          >
                            {product.error ||
                              "This product already has a Size Chart assigned."}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {product.existingChart && (
                      <Button
                        variant="plain"
                        onClick={() => {
                          setViewChart(
                            product.existingChart
                          );

                          setShowRejectedProducts(
                            false
                          );
                        }}
                      >
                        View chart
                      </Button>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <Text
              tone="subdued"
              as="p"
            >
              No rejected products.
            </Text>
          )}
        </Modal.Section>
      </Modal>

      <Modal
        open={Boolean(
          actionProduct &&
            actionType ===
              "edit"
        )}
        onClose={() => {
          setActionProduct(
            null
          );

          setActionType(
            null
          );
        }}
        title="Edit Size Chart"
        primaryAction={{
          content:
            "Continue",
          onAction:
            confirmEdit,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setActionProduct(
                null
              );

              setActionType(
                null
              );
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to edit the Size Chart assigned to{" "}
            <strong>
              {
                actionProduct
                  ?.product
                  ?.title
              }
            </strong>
            ?
          </Text>
        </Modal.Section>
      </Modal>

      <Modal
        open={Boolean(
          actionProduct &&
            actionType ===
              "remove"
        )}
        onClose={() => {
          setActionProduct(
            null
          );

          setActionType(
            null
          );
        }}
        title="Remove Size Chart"
        primaryAction={{
          content:
            "Remove",
          destructive: true,
          onAction:
            confirmRemove,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setActionProduct(
                null
              );

              setActionType(
                null
              );
            },
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to remove the Size Chart from{" "}
            <strong>
              {
                actionProduct
                  ?.product
                  ?.title
              }
            </strong>
            ?
          </Text>
        </Modal.Section>
      </Modal>

      <Modal
        open={Boolean(viewChart)}
        onClose={() =>
          setViewChart(null)
        }
        title={
          viewChart?.title ||
          "Size Chart"
        }
        primaryAction={{
          content: "Close",
          onAction: () =>
            setViewChart(null),
        }}
        large
      >
        <Modal.Section>
          {viewChart ? (
            <div
              style={{
                overflowX:
                  "auto",
              }}
            >
              <table
                style={{
                  width:
                    "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr>
                    {(
                      viewChart.columns ||
                      []
                    ).map(
                      (
                        column
                      ) => (
                        <th
                          key={
                            column.id
                          }
                          style={{
                            padding:
                              "12px",
                            border:
                              "1px solid #e1e3e5",
                            background:
                              "#f6f6f7",
                            textAlign:
                              "center",
                          }}
                        >
                          {
                            column.name
                          }
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {(
                    viewChart.rows ||
                    []
                  ).map(
                    (row) => (
                      <tr
                        key={
                          row.id
                        }
                      >
                        {(
                          viewChart.columns ||
                          []
                        ).map(
                          (
                            column
                          ) => (
                            <td
                              key={
                                column.id
                              }
                              style={{
                                padding:
                                  "12px",
                                border:
                                  "1px solid #e1e3e5",
                                textAlign:
                                  "center",
                              }}
                            >
                              {row[
                                column.id
                              ] ?? ""}
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Text
              tone="subdued"
            >
              Size Chart data is not available.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}