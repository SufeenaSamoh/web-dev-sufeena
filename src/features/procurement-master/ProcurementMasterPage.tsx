import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useStore, formatCurrency } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { SearchableSupplierSelector } from "@/components/SearchableSupplierSelector";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Building2,
  Truck,
  Package,
  FileText,
  History,
  Eye,
  CheckCircle2,
  Clock,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import {
  subscribeDatabaseABranches,
  subscribeDatabaseASuppliers,
  subscribeDatabaseAProducts,
  subscribeDatabaseAOrders,
  subscribeDatabaseAProductLogs,
  saveBranchToDatabaseA,
  deleteBranchFromDatabaseA,
  saveSupplierToDatabaseA,
  deleteSupplierFromDatabaseA,
  saveProductToDatabaseA,
  deleteProductFromDatabaseA,
  saveProductLogToDatabaseA,
  updateOrderStatusInDatabaseA,
  deleteOrderFromDatabaseA,
} from "@/services/purchaseDbA";
import type {
  PurchaseBranch,
  PurchaseSupplier,
  PurchaseProduct,
  PurchaseOrder,
  PurchaseProductChangeLog,
  PurchaseOrderStatus,
} from "../purchase/types";
import { DeletePoModal } from "../purchase/DeletePoModal";

// Empty initial models
const emptyBranch: Omit<PurchaseBranch, "id"> = {
  name: "",
  code: "",
  location: "",
  manager: "",
  phone: "",
  pin: "",
};

const emptySupplier: Omit<PurchaseSupplier, "id"> = {
  name: "",
  code: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  deliveryTerms: "",
  categories: [],
  minOrderAmount: 0,
};

const emptyProduct: Omit<PurchaseProduct, "id"> = {
  code: "",
  name: "",
  supplierId: "",
  supplierName: "",
  category: "",
  unit: "",
  price: 0,
  deliveryTerms: "",
  minOrderQty: 1,
  stockAlertThreshold: 0,
  isActive: true,
  notes: "",
  masterCode: "",
};

export function ProcurementMasterPage() {
  const { currentUser } = useStore();
  const canManage = hasPermission(currentUser, "procurement_master:manage");

  const [activeTab, setActiveTab] = useState<string>("branches");

  // Master Data States
  const [branches, setBranches] = useState<PurchaseBranch[]>([]);
  const [suppliers, setSuppliers] = useState<PurchaseSupplier[]>([]);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [logs, setLogs] = useState<PurchaseProductChangeLog[]>([]);

  // Search and Filter States
  const [branchQuery, setBranchQuery] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productSupplierFilter, setProductSupplierFilter] = useState("all");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderBranchFilter, setOrderBranchFilter] = useState("all");
  const [logQuery, setLogQuery] = useState("");

  // Branch Dialog States
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<PurchaseBranch | null>(null);
  const [branchForm, setBranchForm] = useState<Omit<PurchaseBranch, "id">>(emptyBranch);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);

  // Supplier Dialog States
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<PurchaseSupplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Omit<PurchaseSupplier, "id">>(emptySupplier);
  const [supplierCategoriesRaw, setSupplierCategoriesRaw] = useState("");
  const [deleteSupplierId, setDeleteSupplierId] = useState<string | null>(null);

  // Product Dialog States
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PurchaseProduct | null>(null);
  const [productForm, setProductForm] = useState<Omit<PurchaseProduct, "id">>(emptyProduct);
  const [priceChangeReason, setPriceChangeReason] = useState("");
  const [priceEffectiveDate, setPriceEffectiveDate] = useState("");
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  // Order Detail States
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);

  // Firestore Subscriptions inside useEffect only
  useEffect(() => {
    const unsubBranches = subscribeDatabaseABranches((data) => {
      setBranches(data);
    });
    const unsubSuppliers = subscribeDatabaseASuppliers((data) => {
      setSuppliers(data);
    });
    const unsubProducts = subscribeDatabaseAProducts((data) => {
      setProducts(data);
    });
    const unsubOrders = subscribeDatabaseAOrders((data) => {
      setOrders(data);
    });
    const unsubLogs = subscribeDatabaseAProductLogs((data) => {
      setLogs(data);
    });

    return () => {
      unsubBranches();
      unsubSuppliers();
      unsubProducts();
      unsubOrders();
      unsubLogs();
    };
  }, []);

  // Filtered Lists
  const filteredBranches = useMemo(() => {
    const q = branchQuery.toLowerCase().trim();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        (b.manager && b.manager.toLowerCase().includes(q)) ||
        (b.location && b.location.toLowerCase().includes(q)),
    );
  }, [branches, branchQuery]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.categories && s.categories.some((c) => c.toLowerCase().includes(q))),
    );
  }, [suppliers, supplierQuery]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchCategory = productCategoryFilter === "all" || p.category === productCategoryFilter;
      const matchSupplier =
        productSupplierFilter === "all" || p.supplierId === productSupplierFilter;

      return matchQuery && matchCategory && matchSupplier;
    });
  }, [products, productQuery, productCategoryFilter, productSupplierFilter]);

  const filteredOrders = useMemo(() => {
    const q = orderQuery.toLowerCase().trim();
    return orders.filter((o) => {
      const matchQuery =
        !q ||
        o.id.toLowerCase().includes(q) ||
        (o.branchName && o.branchName.toLowerCase().includes(q)) ||
        (o.supplierName && o.supplierName.toLowerCase().includes(q)) ||
        (o.createdBy && o.createdBy.toLowerCase().includes(q));

      const matchStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
      const matchBranch = orderBranchFilter === "all" || o.branchId === orderBranchFilter;

      return matchQuery && matchStatus && matchBranch;
    });
  }, [orders, orderQuery, orderStatusFilter, orderBranchFilter]);

  const filteredLogs = useMemo(() => {
    const q = logQuery.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.productName.toLowerCase().includes(q) ||
        l.productCode.toLowerCase().includes(q) ||
        (l.supplierName && l.supplierName.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q)) ||
        (l.changedBy && l.changedBy.toLowerCase().includes(q)),
    );
  }, [logs, logQuery]);

  // Branch Handlers
  const handleOpenCreateBranch = () => {
    setEditingBranch(null);
    setBranchForm({
      ...emptyBranch,
      code: `BR-${String(branches.length + 1).padStart(2, "0")}`,
    });
    setBranchModalOpen(true);
  };

  const handleOpenEditBranch = (branch: PurchaseBranch) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      code: branch.code,
      location: branch.location,
      manager: branch.manager,
      phone: branch.phone,
      pin: branch.pin || "",
    });
    setBranchModalOpen(true);
  };

  const handleSaveBranch = async () => {
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      toast.error("กรุณาระบุรหัสสาขาและชื่อสาขา");
      return;
    }
    const branchToSave: PurchaseBranch = {
      id: editingBranch ? editingBranch.id : `branch-${Date.now()}`,
      name: branchForm.name.trim(),
      code: branchForm.code.trim(),
      location: branchForm.location.trim(),
      manager: branchForm.manager.trim(),
      phone: branchForm.phone.trim(),
      pin: branchForm.pin?.trim() || undefined,
    };

    await saveBranchToDatabaseA(branchToSave);
    toast.success(editingBranch ? "บันทึกการแก้ไขสาขาแล้ว" : "เพิ่มสาขาใหม่สำเร็จ");
    setBranchModalOpen(false);
  };

  const handleDeleteBranchConfirm = async () => {
    if (!deleteBranchId) return;
    await deleteBranchFromDatabaseA(deleteBranchId);
    toast.success("ลบข้อมูลสาขาเรียบร้อยแล้ว");
    setDeleteBranchId(null);
  };

  // Supplier Handlers
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      ...emptySupplier,
      code: `SUP-${String(suppliers.length + 1).padStart(3, "0")}`,
    });
    setSupplierCategoriesRaw("");
    setSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier: PurchaseSupplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      code: supplier.code,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      deliveryTerms: supplier.deliveryTerms,
      categories: supplier.categories || [],
      minOrderAmount: supplier.minOrderAmount || 0,
    });
    setSupplierCategoriesRaw((supplier.categories || []).join(", "));
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim() || !supplierForm.code.trim()) {
      toast.error("กรุณาระบุรหัสและชื่อซัพพลายเออร์");
      return;
    }
    const parsedCategories = supplierCategoriesRaw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const supplierToSave: PurchaseSupplier = {
      id: editingSupplier ? editingSupplier.id : `sup-${Date.now()}`,
      name: supplierForm.name.trim(),
      code: supplierForm.code.trim(),
      contactPerson: supplierForm.contactPerson.trim(),
      phone: supplierForm.phone.trim(),
      email: supplierForm.email.trim(),
      address: supplierForm.address.trim(),
      deliveryTerms: supplierForm.deliveryTerms.trim(),
      categories: parsedCategories,
      minOrderAmount: Number(supplierForm.minOrderAmount) || 0,
      branchDeliveryTerms: editingSupplier?.branchDeliveryTerms || {},
    };

    await saveSupplierToDatabaseA(supplierToSave);
    toast.success(editingSupplier ? "บันทึกข้อมูลซัพพลายเออร์แล้ว" : "เพิ่มซัพพลายเออร์ใหม่สำเร็จ");
    setSupplierModalOpen(false);
  };

  const handleDeleteSupplierConfirm = async () => {
    if (!deleteSupplierId) return;
    await deleteSupplierFromDatabaseA(deleteSupplierId);
    toast.success("ลบซัพพลายเออร์เรียบร้อยแล้ว");
    setDeleteSupplierId(null);
  };

  // Product Handlers
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    const defaultSup = suppliers[0];
    setProductForm({
      ...emptyProduct,
      code: `PRD-${String(products.length + 1).padStart(3, "0")}`,
      supplierId: defaultSup?.id || "",
      supplierName: defaultSup?.name || "",
    });
    setPriceChangeReason("");
    setPriceEffectiveDate(new Date().toISOString().slice(0, 10));
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (product: PurchaseProduct) => {
    setEditingProduct(product);
    setProductForm({
      code: product.code,
      name: product.name,
      supplierId: product.supplierId,
      supplierName: product.supplierName,
      category: product.category,
      unit: product.unit,
      price: product.price,
      deliveryTerms: product.deliveryTerms,
      minOrderQty: product.minOrderQty,
      stockAlertThreshold: product.stockAlertThreshold || 0,
      isActive: product.isActive !== false,
      notes: product.notes || "",
      masterCode: product.masterCode || "",
    });
    setPriceChangeReason("");
    setPriceEffectiveDate(new Date().toISOString().slice(0, 10));
    setProductModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.code.trim()) {
      toast.error("กรุณาระบุรหัสสินค้าและชื่อสินค้า");
      return;
    }
    const sup = suppliers.find((s) => s.id === productForm.supplierId);
    const supplierName = sup ? sup.name : productForm.supplierName;
    const newPrice = Number(productForm.price) || 0;

    const productToSave: PurchaseProduct = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      code: productForm.code.trim(),
      name: productForm.name.trim(),
      supplierId: productForm.supplierId,
      supplierName: supplierName || "ไม่ระบุซัพพลายเออร์",
      category: productForm.category.trim(),
      unit: productForm.unit.trim() || "หน่วย",
      price: newPrice,
      deliveryTerms: productForm.deliveryTerms.trim(),
      minOrderQty: Number(productForm.minOrderQty) || 1,
      stockAlertThreshold: Number(productForm.stockAlertThreshold) || 0,
      isActive: productForm.isActive,
      notes: productForm.notes?.trim() || "",
      masterCode: productForm.masterCode?.trim() || "",
    };

    // If editing and price has changed, log price change automatically
    if (editingProduct && editingProduct.price !== newPrice) {
      const logEntry: PurchaseProductChangeLog = {
        id: `log-${Date.now()}`,
        productId: editingProduct.id,
        productCode: productToSave.code,
        productName: productToSave.name,
        supplierName: productToSave.supplierName,
        changeType: "price_change",
        changedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        effectiveDate: priceEffectiveDate || new Date().toISOString().slice(0, 10),
        reason:
          priceChangeReason.trim() ||
          `ปรับราคาจาก ${formatCurrency(editingProduct.price)} เป็น ${formatCurrency(newPrice)}`,
        notes: productToSave.notes,
        previousData: {
          name: editingProduct.name,
          price: editingProduct.price,
          unit: editingProduct.unit,
          category: editingProduct.category,
          isActive: editingProduct.isActive,
          supplierName: editingProduct.supplierName,
        },
        newData: {
          name: productToSave.name,
          price: productToSave.price,
          unit: productToSave.unit,
          category: productToSave.category,
          isActive: productToSave.isActive,
          supplierName: productToSave.supplierName,
        },
        changedBy: currentUser?.name || currentUser?.email || "ผู้ดูแลระบบ",
      };
      await saveProductLogToDatabaseA(logEntry);
    }

    await saveProductToDatabaseA(productToSave);
    toast.success(editingProduct ? "บันทึกข้อมูลสินค้าแล้ว" : "เพิ่มสินค้าใหม่สำเร็จ");
    setProductModalOpen(false);
  };

  const handleDeleteProductConfirm = async () => {
    if (!deleteProductId) return;
    await deleteProductFromDatabaseA(deleteProductId);
    toast.success("ลบรายการสินค้าเรียบร้อยแล้ว");
    setDeleteProductId(null);
  };

  // Order Status Handlers
  const handleUpdateOrderStatus = async (orderId: string, newStatus: PurchaseOrderStatus) => {
    await updateOrderStatusInDatabaseA(
      orderId,
      newStatus,
      undefined,
      currentUser?.name || currentUser?.email || "ฝ่ายจัดซื้อ",
    );
    toast.success(`อัปเดตสถานะใบสั่งซื้อเป็น "${getOrderStatusLabel(newStatus)}" แล้ว`);
    if (viewingOrder && viewingOrder.id === orderId) {
      setViewingOrder({
        ...viewingOrder,
        status: newStatus,
        updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
      });
    }
  };

  // Helpers
  const getOrderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">อนุมัติแล้ว</Badge>;
      case "in_transit":
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">กำลังจัดส่ง</Badge>;
      case "received":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">รับสินค้าแล้ว</Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">ยกเลิก</Badge>;
      case "pending":
      default:
        return (
          <Badge variant="secondary" className="bg-slate-200 text-slate-700">
            รอดำเนินการ
          </Badge>
        );
    }
  };

  const getOrderStatusLabel = (status: PurchaseOrderStatus) => {
    switch (status) {
      case "approved":
        return "อนุมัติแล้ว";
      case "in_transit":
        return "กำลังจัดส่ง";
      case "received":
        return "รับสินค้าแล้ว";
      case "cancelled":
        return "ยกเลิก";
      case "pending":
      default:
        return "รอดำเนินการ";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ข้อมูลหลักจัดซื้อ"
        description="จัดการสาขา ซัพพลายเออร์ รายการสินค้าและราคา ใบสั่งซื้อ และประวัติการเปลี่ยนแปลง (Database A)"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="branches" className="flex items-center gap-2 py-2.5">
            <Building2 className="h-4 w-4" />
            <span>สาขา ({branches.length})</span>
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2 py-2.5">
            <Truck className="h-4 w-4" />
            <span>ซัพพลายเออร์ ({suppliers.length})</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2 py-2.5">
            <Package className="h-4 w-4" />
            <span>รายการสินค้า & ราคา ({products.length})</span>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2 py-2.5">
            <FileText className="h-4 w-4" />
            <span>ใบสั่งซื้อทั้งหมด ({orders.length})</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2 py-2.5">
            <History className="h-4 w-4" />
            <span>ประวัติการแก้ไข ({logs.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: สาขา */}
        <TabsContent value="branches" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">ข้อมูลสาขาจัดซื้อ</CardTitle>
                <CardDescription>
                  รายชื่อสาขาทั้งหมดสำหรับการรับสินค้าและจัดสรรคำสั่งซื้อ
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาสาขา..."
                    value={branchQuery}
                    onChange={(e) => setBranchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {canManage && (
                  <Button onClick={handleOpenCreateBranch} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span>เพิ่มสาขา</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">รหัสสาขา</TableHead>
                      <TableHead>ชื่อสาขา</TableHead>
                      <TableHead>สถานที่ตั้ง</TableHead>
                      <TableHead>ผู้จัดการสาขา</TableHead>
                      <TableHead>เบอร์โทรศัพท์</TableHead>
                      <TableHead>PIN</TableHead>
                      {canManage && <TableHead className="text-right">จัดการ</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 7 : 6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          ไม่พบข้อมูลสาขา
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBranches.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-mono font-medium">{branch.code}</TableCell>
                          <TableCell className="font-medium">{branch.name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {branch.location || "-"}
                          </TableCell>
                          <TableCell>{branch.manager || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{branch.phone || "-"}</TableCell>
                          <TableCell>
                            {branch.pin ? (
                              <Badge variant="outline" className="font-mono">
                                {branch.pin}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditBranch(branch)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteBranchId(branch.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ซัพพลายเออร์ */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">ซัพพลายเออร์ / ผู้จัดจำหน่าย</CardTitle>
                <CardDescription>
                  ข้อมูลผู้ผลิตและคู่ค้าพร้อมเงื่อนไขการจัดส่งและยอดสั่งขั้นต่ำ
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาซัพพลายเออร์..."
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {canManage && (
                  <Button onClick={handleOpenCreateSupplier} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span>เพิ่มซัพพลายเออร์</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">รหัส</TableHead>
                      <TableHead>ชื่อบริษัท / ผู้จัดจำหน่าย</TableHead>
                      <TableHead>ผู้ติดต่อ & เบอร์โทร</TableHead>
                      <TableHead>หมวดหมู่สินค้า</TableHead>
                      <TableHead>เงื่อนไขการจัดส่ง</TableHead>
                      <TableHead className="text-right">สั่งขั้นต่ำ</TableHead>
                      {canManage && <TableHead className="text-right">จัดการ</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 7 : 6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          ไม่พบข้อมูลซัพพลายเออร์
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSuppliers.map((supplier) => (
                        <TableRow key={supplier.id}>
                          <TableCell className="font-mono font-medium">{supplier.code}</TableCell>
                          <TableCell>
                            <div className="font-medium">{supplier.name}</div>
                            {supplier.email && (
                              <div className="text-xs text-muted-foreground">{supplier.email}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{supplier.contactPerson || "-"}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {supplier.phone || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {supplier.categories && supplier.categories.length > 0 ? (
                                supplier.categories.map((c, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {c}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {supplier.deliveryTerms || "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {supplier.minOrderAmount
                              ? formatCurrency(supplier.minOrderAmount)
                              : "-"}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditSupplier(supplier)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteSupplierId(supplier.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: รายการสินค้า & ราคา */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">รายการสินค้าและราคาจัดซื้อ</CardTitle>
                <CardDescription>
                  จัดการรหัสสินค้า ราคาทุนตามซัพพลายเออร์ หน่วยนับ และเงื่อนไขเฉพาะรายการ
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาสินค้า..."
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={productCategoryFilter} onValueChange={setProductCategoryFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="ทุกหมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {allCategories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-56">
                  <SearchableSupplierSelector
                    value={productSupplierFilter}
                    onChange={(val) => setProductSupplierFilter(val || "all")}
                    suppliers={suppliers}
                    allowAll
                    allValue="all"
                    allLabel="ทุกซัพพลายเออร์"
                    allowClear
                    placeholder="ทุกซัพพลายเออร์"
                    searchPlaceholder="พิมพ์ชื่อ, รหัส ซัพพลายเออร์..."
                  />
                </div>
                {canManage && (
                  <Button onClick={handleOpenCreateProduct} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span>เพิ่มสินค้า</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">รหัสสินค้า</TableHead>
                      <TableHead>รายการสินค้า</TableHead>
                      <TableHead>ซัพพลายเออร์</TableHead>
                      <TableHead>หมวดหมู่</TableHead>
                      <TableHead>หน่วย</TableHead>
                      <TableHead className="text-right">ราคาจัดซื้อ (฿)</TableHead>
                      <TableHead className="text-center">สั่งขั้นต่ำ</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      {canManage && <TableHead className="text-right">จัดการ</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 9 : 8}
                          className="text-center py-8 text-muted-foreground"
                        >
                          ไม่พบรายการสินค้า
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono font-medium">{product.code}</TableCell>
                          <TableCell>
                            <div className="font-medium">{product.name}</div>
                            {product.deliveryTerms && (
                              <div className="text-xs text-muted-foreground truncate max-w-xs">
                                {product.deliveryTerms}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{product.supplierName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {product.category || "ทั่วไป"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{product.unit}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-foreground">
                            {formatCurrency(product.price)}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {product.minOrderQty || 1} {product.unit}
                          </TableCell>
                          <TableCell className="text-center">
                            {product.isActive !== false ? (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                ใช้งาน
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">
                                ปิดใช้งาน
                              </Badge>
                            )}
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditProduct(product)}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteProductId(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ใบสั่งซื้อทั้งหมด */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">ใบสั่งซื้อทั้งหมดในระบบ</CardTitle>
                <CardDescription>
                  ตรวจสอบสถานะใบสั่งซื้อของแต่ละสาขา รายการสินค้า และยอดเงินรวม
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาใบสั่งซื้อ..."
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="ทุกสถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                    <SelectItem value="in_transit">กำลังจัดส่ง</SelectItem>
                    <SelectItem value="received">รับสินค้าแล้ว</SelectItem>
                    <SelectItem value="cancelled">ยกเลิก</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={orderBranchFilter} onValueChange={setOrderBranchFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="ทุกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสาขา</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">เลขที่ใบสั่งซื้อ</TableHead>
                      <TableHead>วันที่สั่ง</TableHead>
                      <TableHead>สาขา</TableHead>
                      <TableHead>ซัพพลายเออร์</TableHead>
                      <TableHead className="text-center">รายการ</TableHead>
                      <TableHead className="text-right">ยอดรวม (฿)</TableHead>
                      <TableHead>กำหนดส่ง</TableHead>
                      <TableHead className="text-center">สถานะ</TableHead>
                      <TableHead className="text-right">การจัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          ไม่พบใบสั่งซื้อ
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-medium">{order.id}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDate(order.orderDate)}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{order.branchName}</TableCell>
                          <TableCell className="text-sm">{order.supplierName}</TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {order.items?.length || 0} รายการ
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {formatDate(order.expectedReceivedDate)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getOrderStatusBadge(order.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingOrder(order)}
                                className="h-8 gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>ดูรายละเอียด</span>
                              </Button>
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setOrderToDelete(order)}
                                  title="ลบใบสั่งซื้อ (ต้องระบุเหตุผล)"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: ประวัติการแก้ไข */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-lg">ประวัติการปรับปรุงราคาและข้อมูลสินค้า</CardTitle>
                <CardDescription>
                  บันทึกการเปลี่ยนแปลงราคาสินค้า เหตุผล และผู้ดำเนินการอนุมัติ
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาประวัติการแก้ไข..."
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">วันที่/เวลาบันทึก</TableHead>
                      <TableHead>วันที่มีผล</TableHead>
                      <TableHead>รหัส & สินค้า</TableHead>
                      <TableHead>ซัพพลายเออร์</TableHead>
                      <TableHead>ประเภทการเปลี่ยน</TableHead>
                      <TableHead className="text-right">ราคาเดิม -&gt; ราคาใหม่</TableHead>
                      <TableHead>เหตุผลการปรับเปลี่ยน</TableHead>
                      <TableHead>ผู้ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          ไม่พบประวัติการแก้ไข
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {log.changedAt}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">
                            {log.effectiveDate || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{log.productName}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {log.productCode}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{log.supplierName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.changeType === "price_change"
                                ? "ปรับราคา"
                                : log.changeType === "status_change"
                                  ? "เปลี่ยนสถานะ"
                                  : log.changeType === "spec_change"
                                    ? "เปลี่ยนสเปค"
                                    : "แก้ไขทั่วไป"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {log.previousData?.price !== undefined &&
                            log.newData?.price !== undefined ? (
                              <div className="text-sm">
                                <span className="text-muted-foreground line-through mr-1">
                                  {formatCurrency(log.previousData.price)}
                                </span>
                                <span className="font-semibold text-emerald-600">
                                  {formatCurrency(log.newData.price)}
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-xs">
                            <p className="line-clamp-2">{log.reason || "-"}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.changedBy}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: เพิ่ม/แก้ไข สาขา */}
      <Dialog open={branchModalOpen} onOpenChange={setBranchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBranch ? "แก้ไขข้อมูลสาขา" : "เพิ่มสาขาใหม่"}</DialogTitle>
            <DialogDescription>ระบุข้อมูลรายละเอียดประจำสาขาจัดซื้อ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch-code">รหัสสาขา *</Label>
                <Input
                  id="branch-code"
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                  placeholder="BR-01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-pin">รหัส PIN ประจำสาขา</Label>
                <Input
                  id="branch-pin"
                  value={branchForm.pin || ""}
                  onChange={(e) => setBranchForm({ ...branchForm, pin: e.target.value })}
                  placeholder="1111"
                  maxLength={6}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-name">ชื่อสาขา *</Label>
              <Input
                id="branch-name"
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="สาขา 1 - วัชรพล"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-location">สถานที่ตั้ง / ที่อยู่</Label>
              <Input
                id="branch-location"
                value={branchForm.location}
                onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                placeholder="ถ.วัชรพล เขตบางเขน กรุงเทพฯ"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branch-manager">ผู้จัดการสาขา</Label>
                <Input
                  id="branch-manager"
                  value={branchForm.manager}
                  onChange={(e) => setBranchForm({ ...branchForm, manager: e.target.value })}
                  placeholder="คุณสมชาย ใจดี"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="branch-phone"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  placeholder="081-234-5671"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveBranch}>
              {editingBranch ? "บันทึกการแก้ไข" : "เพิ่มสาขา"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: เพิ่ม/แก้ไข ซัพพลายเออร์ */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "แก้ไขซัพพลายเออร์" : "เพิ่มซัพพลายเออร์ใหม่"}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลผู้จัดจำหน่าย เงื่อนไขการจัดส่ง และยอดสั่งขั้นต่ำ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sup-code">รหัสซัพพลายเออร์ *</Label>
                <Input
                  id="sup-code"
                  value={supplierForm.code}
                  onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                  placeholder="SUP-CP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-min-order">ยอดสั่งขั้นต่ำ (บาท)</Label>
                <Input
                  id="sup-min-order"
                  type="number"
                  value={supplierForm.minOrderAmount || ""}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      minOrderAmount: Number(e.target.value),
                    })
                  }
                  placeholder="1500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-name">ชื่อบริษัท / ผู้จัดจำหน่าย *</Label>
              <Input
                id="sup-name"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="บริษัท ซีพี ฟู้ดส์ จำกัด"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sup-contact">ผู้ติดต่อ</Label>
                <Input
                  id="sup-contact"
                  value={supplierForm.contactPerson}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, contactPerson: e.target.value })
                  }
                  placeholder="คุณกิตติศักดิ์"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-phone">เบอร์โทรศัพท์</Label>
                <Input
                  id="sup-phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="02-711-8000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-email">อีเมลติดต่อ</Label>
              <Input
                id="sup-email"
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                placeholder="order@supplier.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-categories">หมวดหมู่สินค้า (คั่นด้วยเครื่องหมายจุลภาค ,)</Label>
              <Input
                id="sup-categories"
                value={supplierCategoriesRaw}
                onChange={(e) => setSupplierCategoriesRaw(e.target.value)}
                placeholder="เนื้อสัตว์สด, ไก่สด, หมูสด"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-delivery">เงื่อนไขการจัดส่ง</Label>
              <Textarea
                id="sup-delivery"
                value={supplierForm.deliveryTerms}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, deliveryTerms: e.target.value })
                }
                placeholder="สั่งก่อน 16:00 น. จัดส่งวันถัดไป ส่งฟรีเมื่อสั่งเกิน 1,500 บาท"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveSupplier}>
              {editingSupplier ? "บันทึกการแก้ไข" : "เพิ่มซัพพลายเออร์"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: เพิ่ม/แก้ไข สินค้า & ราคา */}
      <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "แก้ไขรายการสินค้าและราคา" : "เพิ่มรายการสินค้าใหม่"}
            </DialogTitle>
            <DialogDescription>
              ระบุรหัสสินค้า ซัพพลายเออร์ ราคาจัดซื้อ และเงื่อนไขการสั่ง
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-code">รหัสสินค้า *</Label>
                <Input
                  id="prod-code"
                  value={productForm.code}
                  onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                  placeholder="PORK-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-master-code">รหัสกลาง (Master Code)</Label>
                <Input
                  id="prod-master-code"
                  value={productForm.masterCode || ""}
                  onChange={(e) => setProductForm({ ...productForm, masterCode: e.target.value })}
                  placeholder="RAW-MEAT-PORK"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-name">ชื่อรายการสินค้า *</Label>
              <Input
                id="prod-name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="เนื้อหมูสันนอกสด (Pork Loin)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-supplier">ซัพพลายเออร์ *</Label>
                <SearchableSupplierSelector
                  id="prod-supplier"
                  value={productForm.supplierId}
                  onChange={(val, sup) => {
                    setProductForm({
                      ...productForm,
                      supplierId: val,
                      supplierName: sup ? sup.name : "",
                    });
                  }}
                  suppliers={suppliers}
                  placeholder="เลือกซัพพลายเออร์..."
                  searchPlaceholder="พิมพ์ชื่อ, รหัส ซัพพลายเออร์..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-category">หมวดหมู่</Label>
                <Input
                  id="prod-category"
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="เนื้อสัตว์สด"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prod-unit">หน่วยนับ *</Label>
                <Input
                  id="prod-unit"
                  value={productForm.unit}
                  onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  placeholder="กก."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-price">ราคาจัดซื้อ (฿) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="any"
                  value={productForm.price || ""}
                  onChange={(e) =>
                    setProductForm({ ...productForm, price: Number(e.target.value) })
                  }
                  placeholder="185"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-min-qty">สั่งขั้นต่ำ</Label>
                <Input
                  id="prod-min-qty"
                  type="number"
                  value={productForm.minOrderQty || 1}
                  onChange={(e) =>
                    setProductForm({ ...productForm, minOrderQty: Number(e.target.value) })
                  }
                  placeholder="1"
                />
              </div>
            </div>

            {/* If editing and price has changed, ask for reason & effective date */}
            {editingProduct && editingProduct.price !== Number(productForm.price) && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-amber-600" />
                  <span>บันทึกการปรับราคา (จากเดิม {formatCurrency(editingProduct.price)})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="price-date" className="text-xs">
                      วันที่มีผล
                    </Label>
                    <ThaiDatePicker
                      id="price-date"
                      value={priceEffectiveDate}
                      onChange={setPriceEffectiveDate}
                      className="h-8 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price-reason" className="text-xs">
                      เหตุผลการปรับราคา
                    </Label>
                    <Input
                      id="price-reason"
                      value={priceChangeReason}
                      onChange={(e) => setPriceChangeReason(e.target.value)}
                      placeholder="เช่น สภาวะตลาด/ต้นทุนอาหารสัตว์"
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="prod-delivery">เงื่อนไขการจัดส่งเฉพาะรายการ</Label>
              <Input
                id="prod-delivery"
                value={productForm.deliveryTerms}
                onChange={(e) => setProductForm({ ...productForm, deliveryTerms: e.target.value })}
                placeholder="สั่งก่อน 15:00 น. จัดส่งวันถัดไป"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="prod-active" className="text-sm font-medium">
                  เปิดใช้งานสินค้านี้
                </Label>
                <div className="text-xs text-muted-foreground">
                  หากปิดการใช้งาน สาขาจะไม่สามารถสั่งซื้อสินค้านี้ได้
                </div>
              </div>
              <Switch
                id="prod-active"
                checked={productForm.isActive !== false}
                onCheckedChange={(checked) => setProductForm({ ...productForm, isActive: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveProduct}>
              {editingProduct ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ดูรายละเอียดใบสั่งซื้อ */}
      <Dialog open={!!viewingOrder} onOpenChange={(open) => !open && setViewingOrder(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingOrder && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="flex items-center gap-2">
                    <span>ใบสั่งซื้อ {viewingOrder.id}</span>
                  </DialogTitle>
                  {getOrderStatusBadge(viewingOrder.status)}
                </div>
                <DialogDescription>
                  สั่งเมื่อ {formatDate(viewingOrder.orderDate)} โดย {viewingOrder.createdBy}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Header Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">สาขาที่สั่ง</span>
                    <span className="font-medium">{viewingOrder.branchName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">ซัพพลายเออร์</span>
                    <span className="font-medium">{viewingOrder.supplierName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">กำหนดส่ง</span>
                    <span className="font-mono">
                      {formatDate(viewingOrder.expectedReceivedDate)}
                    </span>
                  </div>
                  {viewingOrder.actualReceivedDate && (
                    <div>
                      <span className="text-muted-foreground text-xs block">วันที่รับเข้าจริง</span>
                      <span className="font-mono text-emerald-600 font-medium">
                        {formatDate(viewingOrder.actualReceivedDate)}
                      </span>
                    </div>
                  )}
                  {viewingOrder.deliveryTerms && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs block">เงื่อนไขการส่ง</span>
                      <span className="text-xs">{viewingOrder.deliveryTerms}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[100px]">รหัส</TableHead>
                        <TableHead>รายการสินค้า</TableHead>
                        <TableHead className="text-right">จำนวน</TableHead>
                        <TableHead className="text-right">ราคา/หน่วย</TableHead>
                        <TableHead className="text-right">รวม (฿)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingOrder.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.productCode}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{item.productName}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm">
                            {formatCurrency(item.totalPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Order Footer Note & Total */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-muted-foreground">
                    {viewingOrder.notes && <div>หมายเหตุ: {viewingOrder.notes}</div>}
                    {viewingOrder.updatedAt && (
                      <div>อัปเดตล่าสุด: {formatDateTime(viewingOrder.updatedAt)}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">ยอดเงินรวมสุทธิ</span>
                    <span className="text-xl font-bold font-mono text-foreground">
                      {formatCurrency(viewingOrder.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Status Action Buttons for Managers/Admins */}
                {canManage && (
                  <div className="pt-2 border-t space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      เปลี่ยนสถานะใบสั่งซื้อ
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={viewingOrder.status === "approved" ? "default" : "outline"}
                        onClick={() => handleUpdateOrderStatus(viewingOrder.id, "approved")}
                        className="gap-1 h-8"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>อนุมัติคำสั่งซื้อ</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={viewingOrder.status === "in_transit" ? "default" : "outline"}
                        onClick={() => handleUpdateOrderStatus(viewingOrder.id, "in_transit")}
                        className="gap-1 h-8"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        <span>กำลังจัดส่ง</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={viewingOrder.status === "received" ? "default" : "outline"}
                        onClick={() => handleUpdateOrderStatus(viewingOrder.id, "received")}
                        className="gap-1 h-8"
                      >
                        <Package className="h-3.5 w-3.5" />
                        <span>รับสินค้าเข้าแล้ว</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={viewingOrder.status === "cancelled" ? "destructive" : "outline"}
                        onClick={() => handleUpdateOrderStatus(viewingOrder.id, "cancelled")}
                        className="gap-1 h-8"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>ยกเลิก</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingOrder(null)}>
                  ปิดหน้าต่าง
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG: ยืนยันการลบสาขา */}
      <AlertDialog
        open={!!deleteBranchId}
        onOpenChange={(open) => !open && setDeleteBranchId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบข้อมูลสาขา?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบสาขาจะไม่สามารถกู้คืนได้ และอาจกระทบต่อประวัติการสั่งซื้อของสาขานี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBranchConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: ยืนยันการลบซัพพลายเออร์ */}
      <AlertDialog
        open={!!deleteSupplierId}
        onOpenChange={(open) => !open && setDeleteSupplierId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบซัพพลายเออร์?</AlertDialogTitle>
            <AlertDialogDescription>การลบซัพพลายเออร์จะไม่สามารถกู้คืนได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSupplierConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: ยืนยันการลบสินค้า */}
      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={(open) => !open && setDeleteProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบรายการสินค้า?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบรายการสินค้านี้จะนำข้อมูลออกจากระบบจัดซื้อทันที
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProductConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: ยืนยันการลบใบสั่งซื้อ (ต้องระบุเหตุผลทุกครั้ง) */}
      {orderToDelete && (
        <DeletePoModal
          isOpen={!!orderToDelete}
          onClose={() => setOrderToDelete(null)}
          order={orderToDelete}
          onSuccessDeleted={(orderId) => {
            if (viewingOrder?.id === orderId) {
              setViewingOrder(null);
            }
          }}
        />
      )}
    </div>
  );
}
