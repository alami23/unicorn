'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { 
  Search, 
  Plus, 
  Trees, 
  Edit2, 
  Trash2, 
  Box, 
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  Check,
  X,
  ChevronDown,
  Recycle
} from 'lucide-react'
import BinModal from '@/components/BinModal'
import { cn, safeParse } from '@/lib/utils'
import { addNotification } from '@/lib/notifications'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface WoodProduct {
  id: number
  category: string
  treeNo: string
  carNo: string
  width: number
  length: number
  cft: number
  buyPrice: number
  sellPrice: number
  isSold?: boolean
  tag?: string
}

function WoodInventoryPageContent() {
  const [products, setProducts] = useState<WoodProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [categories, setCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])

  useEffect(() => {
    fetchProducts()
    fetchMetadata()
  }, [])

  const fetchMetadata = async () => {
    try {
      const [catRes, subRes, tagRes] = await Promise.all([
        supabase.from('wood_category').select('*').order('name'),
        supabase.from('wood_category_car').select('*').order('name'),
        supabase.from('wood_category_tag').select('*').order('name')
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (subRes.data) setSubCategories(subRes.data);
      if (tagRes.data) setTags(tagRes.data.map((t: any) => ({
        ...t,
        buyPrice: t.buy_price,
        sellPrice: t.sell_price
      })));
    } catch (error) {
      console.error('Error fetching wood metadata:', error)
    }
  }

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('wood_inventory')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      
      if (data) {
        setProducts(data.map(p => ({
          id: p.id,
          category: p.category,
          treeNo: p.tree_no,
          carNo: p.car_no,
          width: Number(p.width),
          length: Number(p.length),
          cft: Number(p.cft),
          buyPrice: Number(p.buy_price),
          sellPrice: Number(p.sell_price),
          isSold: p.is_sold,
          tag: p.tag
        })))
      }
    } catch (error: any) {
      console.error('Error fetching wood inventory:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        error
      })
      toast.error('Failed to load wood inventory: ' + (error.message || 'Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }

  const updateProductTag = async (productId: number, newTag: string) => {
    const selectedTag = tags.find((t: any) => t.name === newTag);
    try {
      const updateData = {
        tag: newTag,
        sell_price: selectedTag ? selectedTag.sellPrice : undefined,
        buy_price: (selectedTag && selectedTag.buyPrice) ? selectedTag.buyPrice : undefined
      };

      const { error } = await supabase
        .from('wood_inventory')
        .update(updateData)
        .eq('id', productId);

      if (error) throw error;
      
      toast.success('Tag updated');
      fetchProducts();
    } catch (error) {
      console.error('Error updating tag:', error);
      toast.error('Failed to update tag');
    }
  };

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCarFilter, setSelectedCarFilter] = useState('All')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isBinModalOpen, setIsBinModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, ids: number[] }>({ isOpen: false, ids: [] });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadDemo = () => {
    try {
      const demoData = [
        {
          'Category': 'Sagun',
          'Car No': 1,
          'Tree No': '101',
          'Width': 24,
          'Length': 12,
          'Buy Price': 1000,
          'Sell Price': 1200
        }
      ];

      const ws = XLSX.utils.json_to_sheet(demoData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Demo Template");
      XLSX.writeFile(wb, "wood_inventory_demo.xlsx");
    } catch (error) {
      console.error('Error downloading demo:', error);
      alert('Failed to download demo template.');
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
          // Get current inventory to check for duplicates
          const { data: existingData, error: fetchError } = await supabase
            .from('wood_inventory')
            .select('category, car_no, tree_no')
            .eq('is_sold', false);
          
          if (fetchError) throw fetchError;

          const existingKeys = new Set(existingData?.map(p => 
            `${p.category?.toLowerCase()}|${p.car_no?.toLowerCase()}|${p.tree_no?.toLowerCase()}`
          ) || []);

          const duplicates: string[] = [];
          const importProducts: any[] = [];

          data.forEach((row: any) => {
            const category = (row.category || row.Category || 'Wood').toString();
            const carNo = (row.carNo || row['Car No'] || '').toString();
            const treeNo = (row.treeNo || row['Tree No'] || '').toString();
            
            const key = `${category.toLowerCase()}|${carNo.toLowerCase()}|${treeNo.toLowerCase()}`;
            
            if (existingKeys.has(key)) {
              duplicates.push(`${category} - ${carNo} - ${treeNo}`);
              return;
            }

            // Track newly added keys within this batch to prevent duplicates within the Excel itself
            existingKeys.add(key);

            const w = Number(row.width || row.Width || 0);
            const l = Number(row.length || row.Length || 0);
            const calculatedCft = parseFloat(((w * w * l) / 2304).toFixed(5));
            
            let sellPrice = Number(row.sellPrice || row['Sell Price'] || 0);
            let buyPrice = Number(row.buyPrice || row['Buy Price'] || 0);
            let tagValue = '';

            const matchingTag = tags.find((t: any) => t.sellPrice === sellPrice);
            if (matchingTag) {
              tagValue = matchingTag.name;
              buyPrice = matchingTag.buyPrice || buyPrice;
            }

            importProducts.push({
              category: category,
              tree_no: treeNo,
              car_no: carNo,
              width: w,
              length: l,
              cft: calculatedCft,
              buy_price: buyPrice,
              sell_price: sellPrice,
              tag: tagValue,
              is_sold: false
            });
          });

          if (importProducts.length > 0) {
            const { error: insertError } = await supabase.from('wood_inventory').insert(importProducts);
            if (insertError) throw insertError;
            
            if (duplicates.length > 0) {
              toast.success(`Imported ${importProducts.length} items. Skipped ${duplicates.length} duplicates.`);
            } else {
              toast.success(`Imported ${importProducts.length} items successfully`);
            }
            fetchProducts();
          } else if (duplicates.length > 0) {
            toast.error(`Import failed: All ${duplicates.length} items already exist in inventory.`);
          }
        }
      } catch (error: any) {
        console.error('Error importing file:', error);
        toast.error('Failed to import file: ' + error.message);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [formData, setFormData] = useState<Partial<WoodProduct>>({
    category: categories[0]?.name || 'Hardwood',
    treeNo: '',
    carNo: '',
    width: 0,
    length: 0,
    cft: 0,
    buyPrice: 0,
    sellPrice: 0,
  })

  const filteredProducts = products.filter(p => {
    if (p.isSold) return false;
    const matchesSearch = p.treeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.carNo.includes(searchTerm);
    if (!matchesSearch) return false;
    
    if (selectedCarFilter !== 'All') {
      const [filterCarNo, filterCategory] = selectedCarFilter.split('|');
      if (p.carNo !== filterCarNo || p.category !== filterCategory) {
        return false;
      }
    }
    
    return true;
  })

  const carCategorySet = new Set<string>()
  products.filter(p => !p.isSold && p.carNo && p.category).forEach(p => {
    carCategorySet.add(`${p.carNo}|${p.category}`)
  })

  const carOptions = Array.from(carCategorySet)
    .map(key => {
      const [carNo, category] = key.split('|')
      return {
        value: key,
        carNo,
        category,
        label: `${carNo} ${category}`
      }
    })
    .sort((a, b) => {
      const carComp = a.carNo.localeCompare(b.carNo, undefined, {numeric: true});
      if (carComp !== 0) return carComp;
      return a.category.localeCompare(b.category);
    })

  const totalCftRemaining = filteredProducts.reduce((sum, p) => sum + (Number(p.cft) || 0), 0)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const newData = { ...formData, [name]: value }

    // Clear treeNo and carNo if category changes
    if (name === 'category') {
      newData.treeNo = ''
      newData.carNo = ''
    }

    // Auto-calculate CFT if width or length changes
    if (name === 'width' || name === 'length') {
      const w = parseFloat(name === 'width' ? value : (formData.width?.toString() || '0')) || 0
      const l = parseFloat(name === 'length' ? value : (formData.length?.toString() || '0')) || 0
      newData.cft = parseFloat(((w * w * l) / 2304).toFixed(5))
    }

    // Auto-select buyPrice if sellPrice matches a tag
    if (name === 'sellPrice') {
      const priceVal = parseFloat(value) || 0
      const matchingTag = tags.find((t: any) => t.sellPrice === priceVal);
      if (matchingTag) {
        newData.buyPrice = matchingTag.buyPrice || newData.buyPrice;
      }
    }

    setFormData(newData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Duplicate Check
      const { data: existing, error: checkError } = await supabase
        .from('wood_inventory')
        .select('id')
        .eq('category', formData.category || '')
        .eq('car_no', formData.carNo || '')
        .eq('tree_no', formData.treeNo || '')
        .eq('is_sold', false)
        .limit(1);

      if (checkError) throw checkError;

      if (existing && existing.length > 0) {
        // If adding new, or updating to a triplet that belongs to another existing item
        if (!editingId || (editingId && existing[0].id !== editingId)) {
          toast.error(`Duplicate Found: An item with Category "${formData.category}", Car No "${formData.carNo}", and Tree No "${formData.treeNo}" already exists in inventory.`);
          return;
        }
      }

      const woodData = {
        category: formData.category,
        tree_no: formData.treeNo,
        car_no: formData.carNo,
        width: formData.width,
        length: formData.length,
        cft: formData.cft,
        buy_price: formData.buyPrice,
        sell_price: formData.sellPrice,
        tag: formData.tag
      }

      if (editingId) {
        const { error } = await supabase
          .from('wood_inventory')
          .update(woodData)
          .eq('id', editingId)
        if (error) throw error
        addNotification('inventory_update', 'Wood Updated', `Wood ID ${editingId} has been updated.`);
        toast.success('Wood item updated')
      } else {
        const { error } = await supabase
          .from('wood_inventory')
          .insert([woodData])
        if (error) throw error
        addNotification('inventory_update', 'Wood Added', `New wood item added.`);
        toast.success('Wood item added')
      }
      
      fetchProducts()
      setIsAdding(false)
      setEditingId(null)
      resetForm()
    } catch (error: any) {
      console.error('Error saving wood item:', error)
      toast.error('Failed to save wood item')
    }
  }

  const resetForm = () => {
    setFormData({
      category: categories[0]?.name || 'Hardwood',
      treeNo: '',
      carNo: '',
      width: 0,
      length: 0,
      cft: 0,
      buyPrice: 0,
      sellPrice: 0,
      tag: ''
    })
  }

  const handleEdit = (product: WoodProduct) => {
    setFormData(product)
    setEditingId(product.id)
    setIsAdding(true)
  }

  const handleDelete = (id: number) => {
    setDeleteConfirm({ isOpen: true, ids: [id] })
  }

  const handleBulkDelete = () => {
    setDeleteConfirm({ isOpen: true, ids: selectedIds })
  }

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('wood_inventory')
        .delete()
        .in('id', deleteConfirm.ids)
      
      if (error) throw error
      
      toast.success('Deleted successfully')
      fetchProducts()
      setSelectedIds(selectedIds.filter(sid => !deleteConfirm.ids.includes(sid)))
    } catch (error) {
      console.error('Error deleting wood items:', error)
      toast.error('Failed to delete')
    } finally {
      setDeleteConfirm({ isOpen: false, ids: [] })
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredProducts.map(p => p.id))
    }
  }

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleExport = () => {
    try {
      const exportData = products.map(p => ({
        'Category': p.category,
        'Car No': p.carNo,
        'Tree No': p.treeNo,
        'Width': p.width,
        'Length': p.length,
        'Buy Price': p.buyPrice,
        'Sell Price': p.sellPrice
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Wood Inventory");
      XLSX.writeFile(wb, "wood_inventory.xlsx");
    } catch (error) {
      console.error('Error exporting file:', error);
      alert('Failed to export file.');
    }
  };

  const selectedCategoryObj = categories.find((c: any) => c.name === formData.category);
  const filteredCarNos = subCategories.filter((sc: any) => sc.category_id === selectedCategoryObj?.id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-[10px]">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Wood Inventory</h1>
          </div>
          <div className="text-right">
            <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">Total Remaining: </span>
              <span className="font-semibold text-amber-600 dark:text-amber-500 text-sm sm:text-base">{totalCftRemaining.toFixed(2)} CFT</span>
            </p>
          </div>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleImport}
          />
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedCarFilter}
              onChange={(e) => setSelectedCarFilter(e.target.value)}
              className="w-full md:w-auto h-11 pl-0 pr-[2px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm font-medium"
            >
              <option value="All">All Cars</option>
              {carOptions.map(car => (
                <option key={car.value} value={car.value}>{car.label}</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by tree no, category, or car no..." 
              className="w-full pl-10 pr-4 h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto pb-1 md:pb-0">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center h-11 md:w-11 px-2 md:px-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
              title="Import Excel"
            >
              <Upload size={18} />
            </button>
            <button 
              onClick={handleExport}
              className="flex-1 md:flex-none flex items-center justify-center h-11 md:w-11 px-2 md:px-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
              title="Export Excel"
            >
              <Download size={18} />
            </button>
            <button 
              onClick={() => setIsBinModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center h-11 md:w-11 px-2 md:px-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all active:scale-95"
              title="Recycle Bin"
            >
              <Recycle size={18} />
            </button>
            <button 
              onClick={() => {
                resetForm()
                setEditingId(null)
                setIsAdding(true)
                setSearchTerm('')
              }}
              className="flex-1 md:flex-none flex items-center justify-center h-11 md:w-11 px-2 md:px-0 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-all shadow-md active:scale-95"
              title="Add Wood Item"
            >
              <Plus size={18} />
            </button>
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex-1 md:flex-none flex items-center justify-center h-11 md:w-11 px-2 md:px-0 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md active:scale-95 animate-in zoom-in-95 cursor-pointer"
                title={`Delete Selected (${selectedIds.length})`}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 font-semibold text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                  </th>
                  <th className="px-4 py-4 font-semibold text-center">No</th>
                  <th className="px-4 py-4 font-semibold text-center">Category</th>
                  <th className="px-4 py-4 font-semibold text-center">Car</th>
                  <th className="px-4 py-4 font-semibold text-center">Tree</th>
                  <th className="px-4 py-4 font-semibold text-center">Width</th>
                  <th className="px-4 py-4 font-semibold text-center">Length</th>
                  <th className="px-4 py-4 font-semibold text-center">CFT</th>
                  <th className="px-4 py-4 font-semibold text-center">Rate</th>
                  <th className="px-4 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product, index) => (
                  <tr key={product.id} className={cn("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group", product.isSold && "opacity-50 pointer-events-none")}>
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        disabled={product.isSold}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-500">{index + 1}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded uppercase tracking-wider">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
                      {product.carNo}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {product.treeNo}
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
                      {product.width}&quot;
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
                      {product.length}&apos;
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-amber-600 dark:text-amber-400">
                      {product.cft.toFixed(5)}
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-bold text-slate-900 dark:text-slate-100">
                      ৳{product.sellPrice}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleEdit(product)}
                          disabled={product.isSold}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors disabled:opacity-50"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          disabled={product.isSold}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
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
        </div>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteConfirm.isOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDeleteConfirm({ isOpen: false, ids: [] })}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
                    <Trash2 size={24} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Delete Item(s)</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Are you sure you want to delete {deleteConfirm.ids.length} item(s)? This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteConfirm({ isOpen: false, ids: [] })}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <BinModal isOpen={isBinModalOpen} onClose={() => setIsBinModalOpen(false)} />

        {/* Import Modal */}
        <AnimatePresence>
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
                    Import Wood Inventory
                  </h2>
                  <button 
                    onClick={() => setIsImportModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link
                      href="/wood-inventory/make-excel"
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 rounded-2xl font-bold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95 shadow-sm"
                    >
                      <Download size={18} /> Make Excel File
                    </Link>
                    <button
                      onClick={handleDownloadDemo}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                    >
                      <Box size={18} /> Download Demo
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
                    onClick={() => {
                      setIsImportModalOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-[0.98]"
                  >
                    <Upload size={18} /> Upload Completed File
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                    {editingId ? 'Edit Wood Item' : 'Add New Wood Item'}
                  </h2>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1st Line: Category, Car No */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category</label>
                      <select 
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                      >
                        {categories.map((cat: any) => (
                          <option key={cat.name} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Car No</label>
                      <select 
                        name="carNo"
                        value={formData.carNo}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                      >
                        <option value="">Select Car No</option>
                        {filteredCarNos.map((sc: any) => (
                          <option key={sc.id} value={sc.name}>{sc.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2nd Line: Tree No, Width, Length */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tree No</label>
                      <input 
                        type="text"
                        name="treeNo"
                        value={formData.treeNo || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                        placeholder="e.g. Segun"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Width (inches)</label>
                      <input 
                        type="number"
                        name="width"
                        value={formData.width || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Length (feet)</label>
                      <input 
                        type="number"
                        name="length"
                        value={formData.length || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                      />
                    </div>

                    {/* 3rd Line: CFT, Buy Price, Sell Price */}
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">CFT (Auto-calculated)</label>
                      <input 
                        readOnly
                        type="number"
                        name="cft"
                        value={formData.cft || ''}
                        className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Buy Price</label>
                      <input 
                        required
                        type="number"
                        name="buyPrice"
                        value={formData.buyPrice || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Sell Price</label>
                      <input 
                        required
                        type="number"
                        name="sellPrice"
                        value={formData.sellPrice || ''}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all"
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
                      {editingId ? 'Update Item' : 'Save Item'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

export default function WoodInventoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <WoodInventoryPageContent />
    </Suspense>
  )
}
