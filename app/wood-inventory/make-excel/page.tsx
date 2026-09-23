'use client'

import React, { useState, useEffect, useRef } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Trash2, Edit, Download, ArrowLeft, Save, PlusCircle, Loader2, ChevronDown, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { addNotification } from '@/lib/notifications'

interface ExcelRow {
  id: string
  category: string
  carNo: string
  tag: string
  treeNo: string
  width: string
  length: string
  buyPrice: string
  sellPrice: string
}

export default function MakeExcelPage() {
  const treeNoRef = useRef<HTMLInputElement>(null)
  const widthRef = useRef<HTMLInputElement>(null)
  const lengthRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const [rows, setRows] = useState<ExcelRow[]>([])
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isSortReversed, setIsSortReversed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    category: '',
    carNo: '',
    tag: '',
    treeNo: '',
    width: '',
    length: '',
    buyPrice: '',
    sellPrice: ''
  })

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, subRes, tagRes, tempRowsRes] = await Promise.all([
          supabase.from('wood_category').select('*').order('name'),
          supabase.from('wood_category_car').select('*').order('name'),
          supabase.from('wood_category_tag').select('*').order('name'),
          supabase.from('make_excel_file').select('*').order('created_at', { ascending: true })
        ]);

        if (catRes.data) {
          setCategories(catRes.data);
        }
        if (subRes.data) setSubCategories(subRes.data);
        if (tagRes.data) setTags(tagRes.data.map((t: any) => ({
          ...t,
          buyPrice: t.buy_price,
          sellPrice: t.sell_price
        })));
        
        if (tempRowsRes.data) {
          setRows(tempRowsRes.data.map(row => ({
            id: row.id,
            category: row.category,
            carNo: row.car_no || '',
            tag: row.tag || '',
            treeNo: row.tree_no || '',
            width: row.width || '',
            length: row.length || '',
            buyPrice: row.buy_price || '',
            sellPrice: row.sell_price || ''
          })));
        }
      } catch (error) {
        console.error('Error fetching wood metadata:', error);
        toast.error('Failed to load categories');
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    fetchMetadata();
  }, []);

  // Sync rows to cloud whenever they change (after initial load)
  useEffect(() => {
    // Removed because we are syncing on every change individually now
  }, [rows, isInitialLoad]);

  const handleTagChange = (tagName: string) => {
    const selectedTag = tags.find(t => t.name === tagName);
    setFormData(prev => ({
      ...prev,
      tag: tagName,
      buyPrice: selectedTag ? (selectedTag.buyPrice || '').toString() : prev.buyPrice,
      sellPrice: selectedTag ? (selectedTag.sellPrice || '').toString() : prev.sellPrice
    }));
  }

  const addRow = () => {
    // Left as compatibility fallback or can be deprecated
    const lastRow = rows[rows.length - 1];
    setRows([
      ...rows,
      {
        id: crypto.randomUUID(),
        category: lastRow?.category || formData.category || '',
        carNo: lastRow?.carNo || formData.carNo || '',
        tag: lastRow?.tag || formData.tag || '',
        treeNo: '',
        width: '',
        length: '',
        buyPrice: lastRow?.buyPrice || formData.buyPrice || '',
        sellPrice: lastRow?.sellPrice || formData.sellPrice || ''
      }
    ])
  }

  const playAlertSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.play().catch(e => console.log('Audio play failed:', e))
    } catch (e) {
      console.error(e);
    }
  }

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error(e);
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category) {
      playAlertSound();
      toast.error('Please select a category');
      return;
    }
    if (!formData.carNo) {
      playAlertSound();
      toast.error('Please select a Car No');
      return;
    }
    if (!formData.treeNo || !formData.treeNo.trim()) {
      playAlertSound();
      toast.error('Please enter a Tree No');
      return;
    }
    const widthVal = parseFloat(formData.width);
    if (!formData.width || isNaN(widthVal) || widthVal <= 0) {
      playAlertSound();
      toast.error('Please enter a valid Width');
      return;
    }
    const lengthVal = parseFloat(formData.length);
    if (!formData.length || isNaN(lengthVal) || lengthVal <= 0) {
      playAlertSound();
      toast.error('Please enter a valid Length');
      return;
    }
    const buyVal = parseFloat(formData.buyPrice);
    if (!formData.buyPrice || isNaN(buyVal) || buyVal <= 0) {
      playAlertSound();
      toast.error('Please enter a valid Buy Price');
      return;
    }
    const sellVal = parseFloat(formData.sellPrice);
    if (!formData.sellPrice || isNaN(sellVal) || sellVal <= 0) {
      playAlertSound();
      toast.error('Please enter a valid Sell Price');
      return;
    }
    
    setIsLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('make_excel_file').update({
          category: formData.category,
          car_no: formData.carNo,
          tag: formData.tag,
          tree_no: formData.treeNo,
          width: formData.width,
          length: formData.length,
          buy_price: formData.buyPrice,
          sell_price: formData.sellPrice
        }).eq('id', editingId);

        if (error) throw error;

        setRows(rows.map(row => row.id === editingId ? {
          ...row,
          category: formData.category,
          carNo: formData.carNo,
          tag: formData.tag,
          treeNo: formData.treeNo,
          width: formData.width,
          length: formData.length,
          buyPrice: formData.buyPrice,
          sellPrice: formData.sellPrice
        } : row));
        toast.success('Item updated successfully');
        setEditingId(null);
      } else {
        const { data, error } = await supabase.from('make_excel_file').insert([{
          category: formData.category,
          car_no: formData.carNo,
          tag: formData.tag,
          tree_no: formData.treeNo,
          width: formData.width,
          length: formData.length,
          buy_price: formData.buyPrice,
          sell_price: formData.sellPrice
        }]).select().single();

        if (error) throw error;

        const newRow: ExcelRow = {
          id: data.id,
          category: data.category,
          carNo: data.car_no || '',
          tag: data.tag || '',
          treeNo: data.tree_no || '',
          width: data.width || '',
          length: data.length || '',
          buyPrice: data.buy_price || '',
          sellPrice: data.sell_price || ''
        };
        
        setRows([...rows, newRow]);
        playSuccessSound();
      }
      
      setFormData(prev => ({
        ...prev,
        treeNo: '',
        width: '',
        length: ''
      }));

      setTimeout(() => {
        treeNoRef.current?.focus();
      }, 50);
    } catch (error: any) {
      console.error(error);
      toast.error('Database error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const removeRow = async (id: string) => {
    try {
      const { error } = await supabase.from('make_excel_file').delete().eq('id', id);
      if (error) throw error;
      
      if (editingId === id) {
        setEditingId(null);
      }
      setRows(rows.filter(row => row.id !== id))
      toast.success('Item removed')
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to remove: ' + error.message);
    }
  }

  const clearAllRows = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from('make_excel_file').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      
      setRows([]);
      setEditingId(null);
      toast.success('All items cleared');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to clear items: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const startEditRow = (row: ExcelRow) => {
    setEditingId(row.id);
    setFormData({
      category: row.category,
      carNo: row.carNo,
      tag: row.tag,
      treeNo: row.treeNo,
      width: row.width,
      length: row.length,
      buyPrice: row.buyPrice,
      sellPrice: row.sellPrice
    });
    toast.info(`Editing item: ${row.treeNo}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const updateRow = (id: string, field: keyof ExcelRow, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row))
  }

  const handleExport = () => {
    if (rows.length === 0) {
      toast.error('Please add at least one item before exporting')
      return
    }
    try {
      const exportData = rows.map(row => {
        const w = parseFloat(row.width) || 0;
        const l = parseFloat(row.length) || 0;
        return {
          'Category': row.category,
          'Car No': row.carNo,
          'Tree No': row.treeNo,
          'Width': w,
          'Length': l,
          'Buy Price': parseFloat(row.buyPrice) || 0,
          'Sell Price': parseFloat(row.sellPrice) || 0
        };
      })

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Wood Inventory")
      
      const category = rows[0]?.category || 'Category';
      const carNo = rows[0]?.carNo || 'Car_No';
      XLSX.writeFile(wb, `${category},${carNo}.xlsx`)
      toast.success('Excel file created successfully')
    } catch (error) {
      console.error('Error exporting excel:', error)
      toast.error('Failed to create excel file')
    }
  }

  const handleUpdateWoodInventory = async () => {
    if (rows.length === 0) {
      toast.error('Please add at least one item before updating inventory')
      return
    }

    setIsUpdating(true)
    try {
      // 1. Fetch existing products from wood_inventory that are unsold to check for duplicates
      const { data: existingData, error: fetchError } = await supabase
        .from('wood_inventory')
        .select('category, car_no, tree_no')
        .eq('is_sold', false)

      if (fetchError) throw fetchError

      // Create a set of existing keys for quick lookup
      const existingKeys = new Set(existingData?.map(p => 
        `${p.category?.toLowerCase()}|${p.car_no?.toLowerCase()}|${p.tree_no?.toLowerCase()}`
      ) || [])

      const duplicates: string[] = []
      const importProducts: any[] = []
      const importedRowIds: string[] = []

      // Track keys in this current batch too to avoid duplicates within the batch itself
      const currentBatchKeys = new Set<string>()

      for (const row of rows) {
        const category = row.category || ''
        const carNo = row.carNo || ''
        const treeNo = row.treeNo || ''

        if (!category || !carNo || !treeNo) {
          continue
        }

        const key = `${category.toLowerCase()}|${carNo.toLowerCase()}|${treeNo.toLowerCase()}`

        // Check if it already exists in wood_inventory OR is a duplicate within this same batch
        if (existingKeys.has(key) || currentBatchKeys.has(key)) {
          duplicates.push(`${category} - ${carNo} - ${treeNo}`)
          continue
        }

        currentBatchKeys.add(key)

        const w = parseFloat(row.width) || 0
        const l = parseFloat(row.length) || 0
        const calculatedCft = parseFloat(((w * w * l) / 2304).toFixed(5))

        importProducts.push({
          category,
          tree_no: treeNo,
          car_no: carNo,
          width: w,
          length: l,
          cft: calculatedCft,
          buy_price: parseFloat(row.buyPrice) || 0,
          sell_price: parseFloat(row.sellPrice) || 0,
          tag: row.tag || '',
          is_sold: false
        })
        importedRowIds.push(row.id)
      }

      if (importProducts.length > 0) {
        // 2. Insert the unique products into wood_inventory
        const { error: insertError } = await supabase
          .from('wood_inventory')
          .insert(importProducts)

        if (insertError) throw insertError

        // 3. Delete the successfully imported items from make_excel_file in database
        const { error: deleteError } = await supabase
          .from('make_excel_file')
          .delete()
          .in('id', importedRowIds)

        if (deleteError) {
          console.error('Error deleting uploaded items from temp file list:', deleteError)
        }

        // 4. Update local state: remove the imported rows
        setRows(prevRows => prevRows.filter(r => !importedRowIds.includes(r.id)))

        // 5. Add notifications
        try {
          addNotification('inventory_update', 'Wood Items Imported', `Imported ${importProducts.length} items directly from Excel Maker.`)
        } catch (notifErr) {
          console.error('Failed to add notification:', notifErr)
        }

        // 6. Alert user
        if (duplicates.length > 0) {
          toast.success(`Successfully uploaded ${importProducts.length} items. Skipped ${duplicates.length} duplicates.`)
        } else {
          toast.success(`Successfully uploaded ${importProducts.length} items to Wood Inventory!`)
        }
      } else {
        toast.error(`No items uploaded. All ${duplicates.length} items already exist in Wood Inventory!`)
      }
    } catch (error: any) {
      console.error('Error updating wood inventory:', error)
      toast.error('Failed to update inventory: ' + (error.message || 'Unknown error'))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              href="/wood-inventory"
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-2xl hover:text-amber-600 transition-all shadow-sm"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Make Excel File</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Prepare your wood inventory data for bulk import.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={handleUpdateWoodInventory}
              disabled={rows.length === 0 || isUpdating}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg shadow-amber-600/20 transition-all active:scale-95 cursor-pointer text-sm"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Update
                </>
              )}
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 w-full md:w-auto px-6 h-[41px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer text-sm"
            >
              <Download size={20} />
              Download Excel
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-6 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-3xl">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                <span className="text-sm font-bold text-slate-500">Loading categories...</span>
              </div>
            </div>
          )}

          {/* Form Input Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full", editingId ? "bg-emerald-500" : "bg-amber-500")} />
                {editingId ? 'Edit Wood Item' : 'Add Wood Item'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (editingId) {
                    setEditingId(null);
                    setFormData(prev => ({
                      ...prev,
                      treeNo: '',
                      width: '',
                      length: ''
                    }));
                    toast.info('Editing cancelled');
                  } else {
                    setFormData({
                      category: '',
                      carNo: '',
                      tag: '',
                      treeNo: '',
                      width: '',
                      length: '',
                      buyPrice: '',
                      sellPrice: ''
                    });
                    toast.success('Fields cleared');
                  }
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-600 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
              >
                {editingId ? 'Cancel' : 'Clear'}
              </button>
            </div>
            
             <form onSubmit={handleAddItem} className="p-6">
              <div className="grid grid-cols-12 gap-4 md:gap-6">
                {/* Category */}
                <div className="col-span-4 md:col-span-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">CATEGORY</label>
                  <div className="relative">
                    <select 
                      value={formData.category}
                      onChange={(e) => {
                        const newCategory = e.target.value;
                        const categoryObj = categories.find(c => c.name === newCategory);
                        
                        setFormData(prev => ({
                          ...prev,
                          category: newCategory
                        }));
                      }}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm font-bold text-slate-900 dark:text-slate-100 transition-all appearance-none cursor-pointer"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Tags */}
                <div className="col-span-4 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">TAGS</label>
                  <div className="relative">
                    <select 
                      value={formData.tag}
                      onChange={(e) => handleTagChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm font-medium text-slate-600 dark:text-slate-400 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Tag</option>
                      {tags.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Car No */}
                <div className="col-span-4 md:col-span-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">CAR NO</label>
                  <input 
                    type="text"
                    placeholder=""
                    value={formData.carNo}
                    onChange={(e) => setFormData(prev => ({ ...prev, carNo: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm font-medium text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>

                {/* Buy Price */}
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">BUY PRICE</label>
                  <div className="relative">
                    <input 
                      type="text"
                      inputMode="decimal"
                      placeholder=""
                      value={formData.buyPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                        setFormData(prev => {
                          let nextTag = prev.tag;
                          if (prev.tag) {
                            const selectedTag = tags.find(t => t.name === prev.tag);
                            if (selectedTag) {
                              const tagBuy = parseFloat(selectedTag.buyPrice || '0');
                              const tagSell = parseFloat(selectedTag.sellPrice || '0');
                              const currBuy = parseFloat(sanitized || '0');
                              const currSell = parseFloat(prev.sellPrice || '0');
                              if (tagBuy !== currBuy || tagSell !== currSell) {
                                nextTag = '';
                              }
                            }
                          }
                          return { ...prev, buyPrice: sanitized, tag: nextTag };
                        });
                      }}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 text-sm font-bold text-black dark:text-black transition-all"
                    />
                  </div>
                </div>

                {/* Sell Price */}
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">SELL PRICE</label>
                  <div className="relative">
                    <input 
                      type="text"
                      inputMode="decimal"
                      placeholder=""
                      value={formData.sellPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                        setFormData(prev => {
                          let nextTag = prev.tag;
                          if (prev.tag) {
                            const selectedTag = tags.find(t => t.name === prev.tag);
                            if (selectedTag) {
                              const tagBuy = parseFloat(selectedTag.buyPrice || '0');
                              const tagSell = parseFloat(selectedTag.sellPrice || '0');
                              const currBuy = parseFloat(prev.buyPrice || '0');
                              const currSell = parseFloat(sanitized || '0');
                              if (tagBuy !== currBuy || tagSell !== currSell) {
                                nextTag = '';
                              }
                            }
                          }
                          return { ...prev, sellPrice: sanitized, tag: nextTag };
                        });
                      }}
                      className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm font-black text-black dark:text-black transition-all"
                    />
                  </div>
                </div>

                {/* Tree No */}
                <div className="col-span-4 md:col-span-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">TREE NO</label>
                  <input 
                    ref={treeNoRef}
                    type="text"
                    inputMode="numeric"
                    placeholder=""
                    value={formData.treeNo}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ ...prev, treeNo: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        widthRef.current?.focus();
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm font-black text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>

                {/* Width */}
                <div className="col-span-4 md:col-span-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">WIDTH (IN)</label>
                  <input 
                    ref={widthRef}
                    type="text"
                    inputMode="decimal"
                    placeholder=""
                    value={formData.width}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                      setFormData(prev => ({ ...prev, width: sanitized }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        lengthRef.current?.focus();
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>

                {/* Length */}
                <div className="col-span-4 md:col-span-3">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">LENGTH (FT)</label>
                  <input 
                    ref={lengthRef}
                    type="text"
                    inputMode="decimal"
                    placeholder=""
                    value={formData.length}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                      setFormData(prev => ({ ...prev, length: sanitized }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem(e);
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 text-sm text-slate-800 dark:text-slate-100 transition-all"
                  />
                </div>

                {/* Add to List / Update Button */}
                <div className="col-span-12 md:col-span-3 flex flex-col justify-end">
                  <span className="text-xs font-bold text-transparent mb-2 block select-none">ACTION</span>
                  <div className="flex gap-2 w-full">
                    <button
                      type="submit"
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white border border-transparent rounded-2xl font-bold transition-all active:scale-95 cursor-pointer text-sm h-[46px]",
                        editingId 
                          ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" 
                          : "bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20"
                      )}
                    >
                      {editingId ? (
                        <>
                          <Save size={18} />
                          Update Item
                        </>
                      ) : (
                        <>
                          <Plus size={18} />
                          Add to List
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* List of Items */}
          <AnimatePresence mode="popLayout">
            {rows.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 shadow-xs">
                  <PlusCircle size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-850 dark:text-slate-100 text-lg">No Items Added</h3>
                  <p className="text-sm text-slate-500 mt-1">Start by adding your first wood item to the Excel sheet template.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
              >
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span>Added Items</span>
                      <span className="px-2.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full font-black">
                        {rows.length}
                      </span>
                    </h3>
                    <button
                      onClick={() => setIsSortReversed(!isSortReversed)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        isSortReversed ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700/50"
                      )}
                      title="Reverse Order"
                    >
                      <ArrowUpDown size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearAllRows}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                {/* Scrollable table view for all devices with auto-responsive scaling */}
                <div className="overflow-x-auto w-full rounded-2xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-left border-collapse min-w-0 table-auto">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] md:text-xs font-black uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-800/20 whitespace-nowrap">
                        <th className="py-2 px-1.5 md:py-4 md:px-6 text-center w-8 md:w-12">No</th>
                        <th className="py-2 px-2 md:py-4 md:px-6 text-center">Car</th>
                        <th className="py-2 px-2 md:py-4 md:px-6 text-center">Tree</th>
                        <th className="py-2 px-1.5 md:py-4 md:px-6 text-center">Width</th>
                        <th className="py-2 px-1.5 md:py-4 md:px-6 text-center">Length</th>
                        <th className="py-2 px-2 md:py-4 md:px-6 text-center">Tag</th>
                        <th className="py-2 px-2 md:py-4 md:px-6 text-center w-16 md:w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(isSortReversed ? [...rows].reverse() : rows).map((row, index) => {
                        const displayIndex = isSortReversed ? rows.length - index : index + 1;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap">
                            <td className="py-2.5 px-1.5 md:py-4 md:px-6 text-center font-bold text-slate-400">{displayIndex}</td>
                            <td className="py-2.5 px-2 md:py-4 md:px-6 text-center">
                              <span className="px-1.5 py-0.5 md:px-2 md:py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] md:text-xs font-mono font-bold inline-block text-center truncate max-w-[70px] md:max-w-none">
                                {row.carNo || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 md:py-4 md:px-6 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                              <span className="truncate inline-block text-center max-w-[80px] md:max-w-none">{row.treeNo || '—'}</span>
                            </td>
                            <td className="py-2.5 px-1.5 md:py-4 md:px-6 text-center font-mono text-[11px] md:text-sm">{row.width ? row.width : '—'}</td>
                            <td className="py-2.5 px-1.5 md:py-4 md:px-6 text-center font-mono text-[11px] md:text-sm">{row.length ? row.length : '—'}</td>
                            <td className="py-2.5 px-2 md:py-4 md:px-6 text-center">
                              {row.tag ? (() => {
                                const tagObj = tags.find(t => t.name === row.tag);
                                const tagColor = tagObj?.color || '#f59e0b';
                                return (
                                  <span 
                                    className="px-1.5 py-0.5 md:px-2.5 md:py-0.5 rounded-full text-[10px] md:text-xs font-bold block md:inline-block text-center truncate max-w-[60px] md:max-w-none"
                                    style={{
                                      backgroundColor: tagColor,
                                      color: '#000000',
                                    }}
                                  >
                                    {row.tag}
                                  </span>
                                );
                              })() : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 md:py-4 md:px-6 text-center">
                              <div className="flex items-center justify-center gap-1 md:gap-2">
                                <button
                                  onClick={() => startEditRow(row)}
                                  className={cn(
                                    "p-1 md:p-1.5 rounded-lg transition-all",
                                    editingId === row.id 
                                      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" 
                                      : "text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  )}
                                  title="Edit Item"
                                >
                                  <Edit size={14} className="md:w-4 md:h-4" />
                                </button>
                                <button
                                  onClick={() => removeRow(row.id)}
                                  className="p-1 md:p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                  title="Delete Item"
                                >
                                  <Trash2 size={14} className="md:w-4 md:h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}
