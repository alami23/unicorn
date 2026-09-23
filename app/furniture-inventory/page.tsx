'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { addNotification } from '@/lib/notifications'
import { 
  Search, 
  Plus, 
  Armchair, 
  Edit2, 
  Trash2, 
  ShoppingBag, 
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  Check,
  X,
  Camera,
  LayoutGrid,
  List
} from 'lucide-react'
import { cn, safeParse } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface FurnitureProduct {
  id: number
  name: string
  category: string
  buy_price: number
  sell_price: number
  stock: number
  image: string
  description: string
  sku: string
}

const initialFurnitureProducts: FurnitureProduct[] = [
  { id: 1, name: 'Royal King Size Bed', category: 'Bed', buy_price: 35000, sell_price: 45000, stock: 5, image: 'https://picsum.photos/seed/bed1/400/400', description: 'Premium king size bed with teak wood finish', sku: 'FUR-BED-001' },
  { id: 2, name: 'Modern Velvet Sofa', category: 'Sofa', buy_price: 25000, sell_price: 32000, stock: 8, image: 'https://picsum.photos/seed/sofa1/400/400', description: '3-seater velvet sofa with ergonomic design', sku: 'FUR-SOF-002' },
]

interface FurnitureCategory {
  id: string
  name: string
  size: string
}

function FurnitureInventoryPageContent() {
  const [products, setProducts] = useState<FurnitureProduct[]>([])
  const [categories, setCategories] = useState<FurnitureCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchProducts = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('furniture_inventory')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          buy_price: Number(p.buy_price || 0),
          sell_price: Number(p.sell_price || p.price || 0),
          stock: Number(p.stock),
          image: p.image,
          description: p.description,
          sku: p.sku
        })))
      }
    } catch (error: any) {
      console.error('Error fetching inventory:', error)
      toast.error('Failed to load furniture inventory')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCategories = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('furniture_category')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      if (data) {
        setCategories(data)
        setFormData(prev => {
          if (data.length > 0) {
            if (!prev.category || prev.category === 'Bed' || !data.some(c => c.name === prev.category)) {
              return { ...prev, category: data[0].name }
            }
          } else {
            return { ...prev, category: '' }
          }
          return prev
        })
      }
    } catch (error: any) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchProducts(),
        fetchCategories()
      ])
      setIsLoading(false)
    }

    fetchInitialData()
  }, [fetchProducts, fetchCategories])

  const [searchTerm, setSearchTerm] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null
  })
  const [isAdding, setIsAdding] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [formData, setFormData] = useState<Partial<FurnitureProduct>>({
    name: '',
    category: '',
    buy_price: '' as any,
    sell_price: '' as any,
    stock: '' as any,
    image: '',
    description: '',
    sku: ''
  })

  const [uploadingImage, setUploadingImage] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }))
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Image upload failed:', error)
      toast.error('Failed to upload image')
      setUploadingImage(false)
    }
  }

  const handleExport = () => {
    try {
      const exportData = products.map(p => ({
        'Name': p.name,
        'Category': p.category,
        'Buy Price': p.buy_price,
        'Sell Price': p.sell_price,
        'Stock Quantity': p.stock,
        'Description': p.description
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Furniture Inventory");
      XLSX.writeFile(wb, "furniture_inventory.xlsx");
      toast.success('Inventory exported successfully!');
    } catch (error) {
      console.error('Error exporting file:', error);
      toast.error('Failed to export file.');
    }
  };

  const handleDownloadDemo = () => {
    try {
      const ws = XLSX.utils.json_to_sheet([], {
        header: ['Name', 'Category', 'Buy Price', 'Sell Price', 'Stock Quantity', 'Description']
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Furniture Demo");
      XLSX.writeFile(wb, "furniture_inventory_demo.xlsx");
      toast.success('Demo template downloaded!');
    } catch (error) {
      console.error('Error downloading demo:', error);
      toast.error('Failed to download demo template.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (data && data.length > 0) {
          // Get current inventory to check for duplicates (by Name & Category) and duplicate SKUs
          const { data: existingData, error: fetchError } = await supabase
            .from('furniture_inventory')
            .select('name, category, sku');
          
          if (fetchError) throw fetchError;

          // Fetch existing categories to check if we need to auto-create any new ones
          const { data: existingCatsData, error: catFetchError } = await supabase
            .from('furniture_category')
            .select('name');
          
          if (catFetchError) throw catFetchError;

          const existingCatsSet = new Set(
            existingCatsData?.map(c => c.name?.toLowerCase().trim()).filter(Boolean) || []
          );

          // Find categories from imported data that do not exist in the database and create them
          const newCategoriesList: { id: string; name: string; description: string; size: string; status: string }[] = [];
          const seenNewCatsInBatch = new Set<string>();

          data.forEach((row: any) => {
            const categoryRaw = (row.category || row.Category || categories[0]?.name || '').toString().trim();
            if (categoryRaw) {
              const categoryLower = categoryRaw.toLowerCase();
              if (!existingCatsSet.has(categoryLower) && !seenNewCatsInBatch.has(categoryLower)) {
                seenNewCatsInBatch.add(categoryLower);
                newCategoriesList.push({
                  id: 'CAT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                  name: categoryRaw,
                  description: 'Auto-created during Excel/CSV import.',
                  size: 'Standard',
                  status: 'Active'
                });
              }
            }
          });

          if (newCategoriesList.length > 0) {
            const { error: catInsertError } = await supabase
              .from('furniture_category')
              .insert(newCategoriesList);
            if (catInsertError) throw catInsertError;
            
            // Add them to our local set so they are recognized as existing
            newCategoriesList.forEach(c => {
              existingCatsSet.add(c.name.toLowerCase().trim());
            });
            toast.info(`Auto-created ${newCategoriesList.length} new custom categories: ${newCategoriesList.map(c => c.name).join(', ')}`);
          }

          const existingProducts = new Set(
            existingData?.map(p => `${p.name?.toLowerCase().trim()}|${p.category?.toLowerCase().trim()}`).filter(Boolean) || []
          );

          const existingSkus = new Set(
            existingData?.map(p => p.sku?.toLowerCase().trim()).filter(Boolean) || []
          );

          const duplicates: string[] = [];
          const importProducts: any[] = [];

          data.forEach((row: any) => {
            const name = (row.name || row.Name || row['Product Name'] || '').toString().trim();
            if (!name) {
              return;
            }
            const category = (row.category || row.Category || categories[0]?.name || '').toString().trim();
            
            // Check for duplicate items (Name + Category case-insensitive)
            const productKey = `${name.toLowerCase()}|${category.toLowerCase()}`;
            if (existingProducts.has(productKey)) {
              duplicates.push(`${name} (${category})`);
              return;
            }
            
            // Add to the local set to prevent importing duplicates within the same file batch
            existingProducts.add(productKey);

            const subCategory = (row.sub_category || row.subCategory || row['Sub Category'] || '').toString().trim();
            const size = (row.size || row.Size || 'Standard').toString().trim();
            const buy_price = Number(row.buy_price || row.buyPrice || row['Buy Price'] || 0);
            const sell_price = Number(row.sell_price || row.sellPrice || row['Sell Price'] || row.price || row.Price || 0);
            const stock = Number(row['Stock Quantity'] || row.stock_quantity || row.stock || row.Stock || row.qty || row.Qty || row.Quantity || row.quantity || 0);
            const description = (row.description || row.Description || '').toString().trim();
            
            // SKU is 100% auto-generated as requested by user
            let sku = '';
            let isUnique = false;
            while (!isUnique) {
              sku = `F-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
              if (!existingSkus.has(sku.toLowerCase())) {
                existingSkus.add(sku.toLowerCase());
                isUnique = true;
              }
            }

            importProducts.push({
              name,
              category,
              sub_category: subCategory || null,
              buy_price,
              sell_price,
              price: sell_price, // fallback legacy column
              size,
              stock,
              description,
              sku,
              image: `https://picsum.photos/seed/${Math.random()}/400/400`
            });
          });

          if (importProducts.length === 0 && duplicates.length > 0) {
            toast.warning(`Import skipped: All ${duplicates.length} items already exist in inventory.`);
            return;
          }

          if (importProducts.length === 0) {
            toast.error('No valid new products found in file.');
            return;
          }

          const { error: insertError } = await supabase
            .from('furniture_inventory')
            .insert(importProducts);

          if (insertError) throw insertError;

          if (duplicates.length > 0) {
            toast.success(`Successfully imported ${importProducts.length} items! Skipped ${duplicates.length} duplicate items.`);
          } else {
            toast.success(`Successfully imported ${importProducts.length} furniture items with auto-generated SKU Codes!`);
          }
          fetchProducts();
        } else {
          toast.error('The selected file is empty.');
        }
      } catch (err: any) {
        console.error('Error importing file:', err);
        toast.error(`Import failed: ${err.message || err}`);
      } finally {
        if (e.target) {
          e.target.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const newData = { ...formData, [name]: value }

    // Clear SKU if category changes
    if (name === 'category') {
      newData.sku = ''
    }

    setFormData(newData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category) {
      toast.error('Please save or select a Furniture Category first.')
      return
    }
    try {
      const productData = {
        name: formData.name,
        category: formData.category,
        buy_price: Number(formData.buy_price) || 0,
        sell_price: Number(formData.sell_price) || 0,
        // Sync with legacy price column for compatibility if needed
        price: Number(formData.sell_price) || 0,
        stock: Number(formData.stock) || 0,
        image: formData.image || `https://picsum.photos/seed/${Math.random()}/400/400`,
        description: formData.description,
        sku: formData.sku || `F-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      }

      if (editingId) {
        const { error } = await supabase
          .from('furniture_inventory')
          .update(productData)
          .eq('id', editingId)
        
        if (error) throw error
        addNotification('inventory_update', 'Furniture Updated', `Furniture ID ${editingId} has been updated.`);
        toast.success('Furniture updated')
      } else {
        const { error } = await supabase
          .from('furniture_inventory')
          .insert([productData])
        
        if (error) throw error
        addNotification('inventory_update', 'Furniture Added', `New furniture item added.`);
        toast.success('Furniture added')
      }
      
      fetchProducts()
      setIsAdding(false)
      setEditingId(null)
      resetForm()
    } catch (error: any) {
      console.error('Error saving furniture:', error)
      toast.error(error?.message ? `Failed to save furniture: ${error.message}` : 'Failed to save furniture item')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: categories[0]?.name || '',
      buy_price: '' as any,
      sell_price: '' as any,
      stock: '' as any,
      image: '',
      description: '',
      sku: ''
    })
  }

  const handleEdit = (product: FurnitureProduct) => {
    setFormData(product)
    setEditingId(product.id)
    setIsAdding(true)
  }

  const handleDelete = (id: number) => {
    setDeleteConfirm({ isOpen: true, id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      const { error } = await supabase
        .from('furniture_inventory')
        .delete()
        .eq('id', deleteConfirm.id)

      if (error) throw error
      
      toast.success('Furniture item deleted successfully!')
      fetchProducts()
    } catch (error: any) {
      console.error('Failed to delete furniture:', error)
      toast.error('Failed to delete furniture item')
    } finally {
      setDeleteConfirm({ isOpen: false, id: null })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mt-0 -mb-[10px]">Furniture Inventory</h1>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, category, or SKU..." 
              className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-row items-center gap-2 w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImport}
            />
            <div className="flex items-center h-11 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm shrink-0">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer", viewMode === 'grid' ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500")}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={cn("p-1.5 rounded-lg transition-all active:scale-95 cursor-pointer", viewMode === 'table' ? "bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500")}
                title="Table View"
              >
                <List size={18} />
              </button>
            </div>
            <button 
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center w-11 h-11 shrink-0 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Import"
            >
              <Upload size={18} className="text-slate-500" />
            </button>
            <button 
              type="button"
              onClick={handleExport}
              className="flex-1 md:flex-none flex items-center justify-center w-11 h-11 shrink-0 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-95 shadow-sm cursor-pointer"
              title="Export"
            >
              <Download size={18} className="text-slate-500" />
            </button>
            <button 
              onClick={() => {
                resetForm()
                setEditingId(null)
                setIsAdding(true)
                setSearchTerm('')
              }}
              className="flex-1 md:flex-none flex items-center justify-center w-11 h-11 shrink-0 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              title="Add Furniture"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Inventory View */}
        {viewMode === 'table' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Product</th>
                    <th className="px-6 py-4 font-semibold">SKU</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Stock</th>
                    <th className="px-6 py-4 font-semibold text-amber-600">Buy Price</th>
                    <th className="px-6 py-4 font-semibold text-emerald-600">Sell Price</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                            <Image 
                              src={product.image} 
                              alt={product.name} 
                              fill
                              sizes="48px"
                              className="object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{product.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{product.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">
                        {product.sku}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded uppercase tracking-wider">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "text-sm font-bold",
                            product.stock < 5 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"
                          )}>
                            {product.stock} units
                          </span>
                          <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full",
                                product.stock < 5 ? "bg-rose-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, (product.stock / 20) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-rose-600 dark:text-rose-400">
                        ৳{product.buy_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        ৳{product.sell_price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleEdit(product)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(product.id)}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Table View (Simplified list) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((product) => (
                <div key={product.id} className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative flex-shrink-0">
                    <Image src={product.image} alt={product.name} fill sizes="48px" className="object-cover" referrerPolicy="no-referrer"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{product.name}</p>
                    <p className="text-xs text-slate-500 truncate">{product.sku} • {product.category}</p>
                    <div className="flex gap-2 items-center">
                      <p className="text-sm font-bold text-amber-600">৳{product.sell_price.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 line-through">৳{product.buy_price.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(product)} className="p-2 rounded-lg text-slate-400 hover:text-amber-600"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(product.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <Image 
                    src={product.image} 
                    alt={product.name} 
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button 
                      onClick={() => handleEdit(product)}
                      className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 shadow-sm transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(product.id)}
                      className="p-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 shadow-sm transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{product.category}</p>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 mt-1">{product.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900 dark:text-slate-100">৳{product.sell_price.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">Buy: ৳{product.buy_price.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{product.sku}</p>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      product.stock > 5 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                    )}>
                      {product.stock} IN STOCK
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {isAdding && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAdding(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {editingId ? 'Edit Furniture' : 'Add New Furniture'}
                  </h2>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Image Upload Area */}
                  <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative overflow-hidden group h-40">
                    {formData.image ? (
                      <div className="relative w-full h-full rounded-xl overflow-hidden">
                        <Image 
                          src={formData.image} 
                          alt="Preview" 
                          fill 
                          className="object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <button 
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                            className="p-3 bg-rose-500 text-white rounded-full hover:scale-110 transition-transform"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:text-amber-500 transition-colors">
                          {uploadingImage ? (
                            <div className="w-6 h-6 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera size={24} />
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Click to upload photo</p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG or WebP (max 5MB)</p>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingImage}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                    <div className="col-span-full space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Furniture Name</label>
                      <input 
                        required
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all font-medium"
                        placeholder="e.g. Royal King Size Bed"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
                      <select 
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                      >
                        {categories.length > 0 ? (
                          categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))
                        ) : (
                          <option value="">No Category Saved</option>
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stock Quantity</label>
                      <input 
                        required
                        type="number"
                        name="stock"
                        value={Number.isNaN(formData.stock) ? '' : formData.stock}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                        placeholder="0"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">SKU Code</label>
                      <input 
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 opacity-70"
                        placeholder="F-XXXX"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-2">
                      <label className="text-sm font-bold text-rose-600 dark:text-rose-400">Buy Price (৳)</label>
                      <input 
                        required
                        type="number"
                        name="buy_price"
                        value={Number.isNaN(formData.buy_price) ? '' : formData.buy_price}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:text-slate-100 transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-2">
                      <label className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Sell Price (৳)</label>
                      <input 
                        required
                        type="number"
                        name="sell_price"
                        value={Number.isNaN(formData.sell_price) ? '' : formData.sell_price}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-slate-100 transition-all font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-full space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Description</label>
                      <textarea 
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all min-h-[100px]"
                        placeholder="Add some details about this furniture item..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                    >
                      {editingId ? 'Update Furniture' : 'Save Furniture'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
          
          {/* Import Modal */}
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsImportModalOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Import Furniture Inventory
                  </h2>
                  <button 
                    onClick={() => setIsImportModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Bulk import your furniture products using an Excel formatted sheet (.xlsx, .xls) or .csv file.
                    </p>
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                      Column template: Name, Category, Buy Price, Sell Price, Stock Quantity, Description, SKU Code.
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadDemo}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                    >
                      <Armchair size={18} /> Download Demo
                    </button>
                  </div>
                  
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      <span className="px-3 bg-white dark:bg-slate-900">Next Step</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-[0.98]"
                  >
                    <Upload size={18} /> Select & Upload File
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm.isOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center"
              >
                <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Delete Furniture Item?
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  Are you sure you want to delete this furniture item? This action is permanent and cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-rose-600/20 active:scale-95"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

export default function FurnitureInventoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <FurnitureInventoryPageContent />
    </Suspense>
  )
}
