'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, Trees, Edit2, Trash2, Box, ChevronRight, Layers, X, Tags, RefreshCcw, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

function WoodCategoryPageContent() {
  const [categories, setCategories] = useState<any[]>([])
  const [subCategories, setSubCategories] = useState<any[]>([])
  const [tags, setTags] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const fetchMetadata = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Auto-sync with inventory first
      const { data: rawProducts } = await supabase
        .from('wood_inventory')
        .select('category, car_no')
        .eq('is_sold', false);
        
      if (rawProducts && rawProducts.length > 0) {
        const [{ data: existingCats }, { data: existingSubs }] = await Promise.all([
          supabase.from('wood_category').select('*'),
          supabase.from('wood_category_car').select('*')
        ]);

        const catMapByName = new Map<string, any>();
        existingCats?.forEach(c => catMapByName.set(String(c.name).trim().toLowerCase(), c));

        const subKeySet = new Set(existingSubs?.map(s => `${s.category_id}|${String(s.name).trim().toLowerCase()}`) || []);

        const newCats: any[] = [];
        const newSubs: any[] = [];

        const pairs = rawProducts.map(p => ({
          catName: String(p.category || 'Uncategorized').trim(),
          carNo: String(p.car_no || 'Unknown').trim()
        }));
        
        const uniquePairs = Array.from(new Set(pairs.map(p => `${p.catName}|${p.carNo}`)))
          .map(p => {
            const [catName, carNo] = p.split('|');
            return { catName, carNo };
          });

        const newlyCreatedCats = new Map<string, string>();

        for (const pair of uniquePairs) {
          let catId = catMapByName.get(pair.catName.toLowerCase())?.id || newlyCreatedCats.get(pair.catName.toLowerCase());

          if (!catId) {
            catId = `CAT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            newCats.push({
              id: catId,
              name: pair.catName,
              type: 'Raw Material',
              
              status: 'Active'
            });
            newlyCreatedCats.set(pair.catName.toLowerCase(), catId);
          }

          const subKey = `${catId}|${pair.carNo.toLowerCase()}`;
          if (!subKeySet.has(subKey)) {
            newSubs.push({
              id: `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              category_id: catId,
              name: pair.carNo,
              item_count: 0,
              status: 'Active'
            });
            subKeySet.add(subKey);
          }
        }

        if (newCats.length > 0) await supabase.from('wood_category').insert(newCats);
        if (newSubs.length > 0) await supabase.from('wood_category_car').insert(newSubs);
      }

      // 2. Fetch the updated state
      const [catRes, subRes, tagRes, prodRes] = await Promise.all([
        supabase.from('wood_category').select('*').order('name'),
        supabase.from('wood_category_car').select('*').order('name'),
        supabase.from('wood_category_tag').select('*').order('name'),
        supabase.from('wood_inventory').select('category, car_no').eq('is_sold', false)
      ]);

      if (catRes.error) throw catRes.error;
      if (subRes.error) throw subRes.error;
      if (tagRes.error) throw tagRes.error;
      if (prodRes.error) throw prodRes.error;

      const catsRaw = catRes.data || [];
      const subsRaw = subRes.data || [];
      const tagsData = tagRes.data || [];
      const products = prodRes.data || [];

      // Deduplicate Categories
      const uniqueCatsMap = new Map<string, any>();
      const duplicateCatIds: string[] = [];
      catsRaw.forEach(c => {
        const key = String(c.name).trim().toLowerCase();
        if (!uniqueCatsMap.has(key)) {
          uniqueCatsMap.set(key, { ...c, name: String(c.name).trim() });
        } else {
          duplicateCatIds.push(c.id);
        }
      });
      const cats = Array.from(uniqueCatsMap.values());

      // Deduplicate Subcategories (Car No)
      const uniqueSubsMap = new Map<string, any>();
      const duplicateSubIds: string[] = [];
      subsRaw.forEach(s => {
        const key = `${s.category_id}|${String(s.name).trim().toLowerCase()}`;
        if (!uniqueSubsMap.has(key)) {
          uniqueSubsMap.set(key, { ...s, name: String(s.name).trim() });
        } else {
          duplicateSubIds.push(s.id);
        }
      });
      const subs = Array.from(uniqueSubsMap.values());

      // Background cleanup of duplicates
      if (duplicateCatIds.length > 0) supabase.from('wood_category').delete().in('id', duplicateCatIds).then();
      if (duplicateSubIds.length > 0) supabase.from('wood_category_car').delete().in('id', duplicateSubIds).then();

      // Calculate enriched subcategories with item counts from wood_inventory
      const enrichedSubs = subs.map(sub => {
        const parentCat = cats.find(c => c.id === sub.category_id);
        const count = products.filter(p => 
          String(p.car_no).trim().toLowerCase() === String(sub.name).trim().toLowerCase() && 
          (!parentCat || String(p.category).trim().toLowerCase() === String(parentCat.name).trim().toLowerCase())
        ).length;
        return { ...sub, itemCount: count };
      });

      setCategories(cats);
      setSubCategories(enrichedSubs);
      setTags(tagsData.map((t: any) => ({
        ...t,
        buyPrice: t.buy_price,
        sellPrice: t.sell_price
      })));
      
      if (cats.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(cats[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching wood metadata:', error);
      toast.error('Failed to load categories: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false)
  const [editCategoryData, setEditCategoryData] = useState<any>(null)

  const [isAddSubCategoryOpen, setIsAddSubCategoryOpen] = useState(false)
  const [isEditSubCategoryOpen, setIsEditSubCategoryOpen] = useState(false)
  const [editSubCategoryData, setEditSubCategoryData] = useState<any>(null)

  const [isAddTagOpen, setIsAddTagOpen] = useState(false)
  const [isEditTagOpen, setIsEditTagOpen] = useState(false)
  const [editTagData, setEditTagData] = useState<any>(null)

  const [newCategory, setNewCategory] = useState({ name: '', type: 'Raw Material',  })
  const [newSubCategory, setNewSubCategory] = useState({ name: '', numberOfTrees: 0 })
  const [detectedInventoryCount, setDetectedInventoryCount] = useState<number>(0)

  const detectInventoryCount = React.useCallback(async (name: string) => {
    if (!name.trim()) {
      setDetectedInventoryCount(0);
      return;
    }
    try {
      const parentCat = categories.find(c => c.id === selectedCategoryId);
      const { data, count, error } = await supabase
        .from('wood_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('car_no', name)
        .eq('is_sold', false)
        .eq('category', parentCat?.name || '');
      
      if (error) throw error;
      setDetectedInventoryCount(count || 0);
    } catch (err) {
      console.error('Error detecting inventory:', err);
      setDetectedInventoryCount(0);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (isAddSubCategoryOpen || isEditSubCategoryOpen) {
      const name = isAddSubCategoryOpen ? newSubCategory.name : editSubCategoryData?.name;
      if (name) detectInventoryCount(name);
    }
  }, [newSubCategory.name, editSubCategoryData?.name, isAddSubCategoryOpen, isEditSubCategoryOpen, detectInventoryCount]);

  const [newTag, setNewTag] = useState<{ name: string; buyPrice: number | string; sellPrice: number | string; color: string }>({ name: '', buyPrice: '', sellPrice: '', color: '#3b82f6' })
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, type: 'category' | 'subCategory' | 'tag' | null, id: string | null }>({ isOpen: false, type: null, id: null })
  const [mobileView, setMobileView] = useState<'categories' | 'carno' | 'tags'>('categories')

  const activeCategory = categories.find((c: any) => c.id === selectedCategoryId)
  const filteredSubCategories = subCategories.filter((sc: any) => sc.category_id === selectedCategoryId)

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return
    
    // Check for duplicate category name
    const categoryNameInput = newCategory.name.trim().toLowerCase();
    if (categories.some((c: any) => c.name.trim().toLowerCase() === categoryNameInput)) {
      toast.error(`Category "${newCategory.name.trim()}" already exists!`)
      return
    }

    const newCat = {
      id: `CAT-${Date.now()}`,
      name: newCategory.name.trim(),
      type: newCategory.type,
      
      status: 'Active'
    }
    
    try {
      const { error } = await supabase.from('wood_category').insert([newCat]);
      if (error) throw error;
      
      setCategories([...categories, newCat])
      setNewCategory({ name: '', type: 'Raw Material',  })
      setIsAddCategoryOpen(false)
      setSelectedCategoryId(newCat.id)
      toast.success('Category added to cloud')
    } catch (error: any) {
      toast.error('Failed to save category: ' + error.message)
    }
  }

  const openEditCategory = (cat: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditCategoryData(cat)
    setIsEditCategoryOpen(true)
  }

  const handleUpdateCategory = async () => {
    if (!editCategoryData?.name.trim()) return
    
    const categoryNameInput = editCategoryData.name.trim().toLowerCase();
    if (categories.some((c: any) => c.id !== editCategoryData.id && c.name.trim().toLowerCase() === categoryNameInput)) {
      toast.error(`Category "${editCategoryData.name.trim()}" already exists!`)
      return
    }

    try {
      const { error } = await supabase
        .from('wood_category')
        .update({
          name: editCategoryData.name.trim(),
          type: editCategoryData.type,
          
          status: editCategoryData.status
        })
        .eq('id', editCategoryData.id);
      
      if (error) throw error;

      setCategories(categories.map((c: any) => c.id === editCategoryData.id ? { ...c, ...editCategoryData, name: editCategoryData.name.trim() } : c))
      setIsEditCategoryOpen(false)
      toast.success('Category updated')
    } catch (error: any) {
      toast.error('Update failed: ' + error.message)
    }
  }

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirmation({ isOpen: true, type: 'category', id })
  }

  const handleAddSubCategory = async () => {
    if (!newSubCategory.name.trim() || !selectedCategoryId) return
    
    // Check for duplicate sub-category name within the current category
    const subCatNameInput = newSubCategory.name.trim().toLowerCase();
    if (subCategories.some((sc: any) => sc.category_id === selectedCategoryId && sc.name.trim().toLowerCase() === subCatNameInput)) {
      toast.error(`Car No "${newSubCategory.name.trim()}" already exists in the selected category!`)
      return
    }

    const subId = `SUB-${Date.now()}`
    const newSubCat = {
      id: subId,
      category_id: selectedCategoryId,
      name: newSubCategory.name.trim(),
      item_count: 0,
      status: 'Active'
    }
    
    try {
      const { error } = await supabase.from('wood_category_car').insert([newSubCat]);
      if (error) throw error;

      setSubCategories([...subCategories, { ...newSubCat, category_id: selectedCategoryId, itemCount: 0 }])
      setNewSubCategory({ name: '', numberOfTrees: 0 })
      setIsAddSubCategoryOpen(false)
      toast.success('Car No added')
    } catch (error: any) {
      toast.error('Failed to save Car No: ' + error.message)
    }
  }

  const openEditSubCategory = (sub: any) => {
    setEditSubCategoryData(sub)
    setIsEditSubCategoryOpen(true)
  }

  const handleUpdateSubCategory = async () => {
    if (!editSubCategoryData?.name.trim()) return

    const subCatNameInput = editSubCategoryData.name.trim().toLowerCase();
    if (subCategories.some((sc: any) => sc.id !== editSubCategoryData.id && sc.category_id === editSubCategoryData.category_id && sc.name.trim().toLowerCase() === subCatNameInput)) {
      toast.error(`Car No "${editSubCategoryData.name.trim()}" already exists in the selected category!`)
      return
    }

    try {
      const { error } = await supabase
        .from('wood_category_car')
        .update({
          name: editSubCategoryData.name.trim(),
          status: editSubCategoryData.status
        })
        .eq('id', editSubCategoryData.id);
      
      if (error) throw error;

      setSubCategories(subCategories.map((sc: any) => sc.id === editSubCategoryData.id ? { ...sc, ...editSubCategoryData, name: editSubCategoryData.name.trim() } : sc))
      setIsEditSubCategoryOpen(false)
      toast.success('Car No updated')
    } catch (error: any) {
      toast.error('Update failed: ' + error.message)
    }
  }

  const handleDeleteSubCategory = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'subCategory', id })
  }

  const handleAddTag = async () => {
    if (!newTag.name.trim()) return
    const buy_price = parseFloat(String(newTag.buyPrice)) || 0
    const sell_price = parseFloat(String(newTag.sellPrice)) || 0
    const tag = {
      id: `TAG-${Date.now()}`,
      name: newTag.name,
      buy_price,
      sell_price,
      color: newTag.color || '#3b82f6',
      status: 'Active'
    }

    try {
      const { error } = await supabase.from('wood_category_tag').insert([tag]);
      if (error) throw error;

      setTags([...tags, { ...tag, buyPrice: tag.buy_price, sellPrice: tag.sell_price }])
      setNewTag({ name: '', buyPrice: '', sellPrice: '', color: '#3b82f6' })
      setIsAddTagOpen(false)
      toast.success('Tag added')
    } catch (error: any) {
      toast.error('Failed to save tag: ' + error.message)
    }
  }

  const openEditTag = (tag: any) => {
    setEditTagData(tag)
    setIsEditTagOpen(true)
  }

  const handleUpdateTag = async () => {
    if (!editTagData?.name.trim()) return
    const buy_price = parseFloat(String(editTagData.buyPrice)) || 0
    const sell_price = parseFloat(String(editTagData.sellPrice)) || 0
    try {
      const { error } = await supabase
        .from('wood_category_tag')
        .update({
          name: editTagData.name,
          buy_price,
          sell_price,
          color: editTagData.color,
          status: editTagData.status
        })
        .eq('id', editTagData.id);
      
      if (error) throw error;

      // Auto-update wood inventory items matching this tag
      const tagName = editTagData.name.trim();
      const { error: invUpdateError } = await supabase
        .from('wood_inventory')
        .update({
          buy_price,
          sell_price
        })
        .eq('tag', tagName);

      if (invUpdateError) {
        console.error('Error auto-updating wood inventory:', invUpdateError);
      }

      setTags(tags.map((t: any) => t.id === editTagData.id ? { ...editTagData, buyPrice: buy_price, sellPrice: sell_price } : t))
      setIsEditTagOpen(false)
      toast.success('Tag updated & wood inventory prices auto-updated')
    } catch (error: any) {
      toast.error('Update failed: ' + error.message)
    }
  }

  const handleDeleteTag = (id: string) => {
    setDeleteConfirmation({ isOpen: true, type: 'tag', id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation.id || !deleteConfirmation.type) return;

    try {
      let table = '';
      if (deleteConfirmation.type === 'category') table = 'wood_category';
      else if (deleteConfirmation.type === 'subCategory') table = 'wood_category_car';
      else if (deleteConfirmation.type === 'tag') table = 'wood_category_tag';

      const { error } = await supabase.from(table).delete().eq('id', deleteConfirmation.id);
      if (error) throw error;

      if (deleteConfirmation.type === 'category') {
        setCategories(categories.filter((c: any) => c.id !== deleteConfirmation.id))
        if (selectedCategoryId === deleteConfirmation.id) setSelectedCategoryId(null)
        setSubCategories(subCategories.filter((sc: any) => sc.category_id !== deleteConfirmation.id))
      } else if (deleteConfirmation.type === 'subCategory') {
        setSubCategories(subCategories.filter((sc: any) => sc.id !== deleteConfirmation.id))
      } else if (deleteConfirmation.type === 'tag') {
        setTags(tags.filter((t: any) => t.id !== deleteConfirmation.id))
      }
      
      toast.success('Deleted successfully');
    } catch (error: any) {
      toast.error('Deletion failed: ' + error.message);
    } finally {
      setDeleteConfirmation({ isOpen: false, type: null, id: null })
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 flex flex-col h-[calc(100vh-100px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 -mb-[7px]">Wood Category</h1>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 min-h-[500px] lg:h-full relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-2xl">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                <span className="text-sm font-bold text-slate-500">Syncing database...</span>
              </div>
            </div>
          )}
          {/* Mobile Tab Navigation */}
          <div className="lg:hidden flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm shrink-0">
            {[
              { id: 'categories', label: 'Categories', icon: Box },
              { id: 'carno', label: 'Car No', icon: Layers },
              { id: 'tags', label: 'Tags', icon: Tags }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMobileView(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all",
                  mobileView === tab.id 
                    ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Left Side: Categories */}
          <div className={cn(
            "w-full lg:w-1/4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all",
            mobileView !== 'categories' && "hidden lg:flex"
          )}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Box size={18} className="text-amber-600" /> Categories
              </h2>
              <button 
                onClick={() => setIsAddCategoryOpen(true)}
                className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[300px]">
              {categories.map((cat: any) => (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    if (window.innerWidth < 1024) setMobileView('carno');
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left group cursor-pointer",
                    selectedCategoryId === cat.id 
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 border" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      selectedCategoryId === cat.id
                        ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                    )}>
                      <Trees size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className={cn(
                        "text-sm font-bold truncate",
                        selectedCategoryId === cat.id ? "text-amber-900 dark:text-amber-100" : "text-slate-700 dark:text-slate-300"
                      )}>{cat.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 transition-opacity lg:mr-2">
                      <button 
                        onClick={(e) => openEditCategory(cat, e)} 
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteCategory(cat.id, e)} 
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <ChevronRight size={16} className={cn(
                      "transition-colors",
                      selectedCategoryId === cat.id ? "text-amber-600" : "text-slate-300 dark:text-slate-600"
                    )} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Middle Side: Car No */}
          <div className={cn(
            "w-full lg:w-1/4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all",
            mobileView !== 'carno' && "hidden lg:flex"
          )}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Layers size={18} className="text-amber-600" /> 
                  Car No
                </h2>
              </div>
              <button 
                disabled={!selectedCategoryId}
                onClick={() => setIsAddSubCategoryOpen(true)}
                className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar min-h-[300px]">
              {selectedCategoryId ? (
                filteredSubCategories.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSubCategories.map((sub: any) => (
                      <div key={sub.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{sub.name}</div>
                          <div className="text-xs text-slate-500">{sub.itemCount} Items</div>
                        </div>
                        <div className="flex items-center gap-1 transition-opacity">
                          <button onClick={() => openEditSubCategory(sub)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteSubCategory(sub.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-3 p-8 text-center">
                    <Layers size={32} className="text-slate-200 dark:text-slate-700" />
                    <p className="text-xs">No Car No found.</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-3 p-8 text-center">
                  <Box size={32} className="text-slate-200 dark:text-slate-700" />
                  <p className="text-xs">Select category.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Tags */}
          <div className={cn(
            "w-full lg:w-2/4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all",
            mobileView !== 'tags' && "hidden lg:flex"
          )}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Tags size={18} className="text-amber-600" /> Tags
              </h2>
              <button 
                onClick={() => setIsAddTagOpen(true)}
                className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar min-h-[300px]">
              {/* Desktop view for Tags table */}
              <div className="hidden sm:block">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Tag Name</th>
                      <th className="px-6 py-3 font-semibold">Buy Price</th>
                      <th className="px-6 py-3 font-semibold">Sell Price</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tags.map((tag: any) => (
                      <tr key={tag.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {tag.color && (
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }}></div>
                            )}
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{tag.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400">৳{(tag.buyPrice || 0).toLocaleString()}</td>
                        <td className="px-6 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">৳{(tag.sellPrice || 0).toLocaleString()}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">{tag.status}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditTag(tag)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteTag(tag.id)} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view for Tags list */}
              <div className="sm:hidden p-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="grid grid-cols-1 min-[450px]:grid-cols-2 gap-3">
                  {tags.map((tag: any) => (
                    <div 
                      key={tag.id} 
                      className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 p-4 rounded-xl shadow-xs hover:border-slate-200 dark:hover:border-slate-800 transition-all flex flex-col justify-between relative overflow-hidden"
                    >
                      {/* Left accent color strip */}
                      {tag.color && (
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: tag.color }}></div>
                      )}
                      
                      <div className="pl-2 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{tag.name}</h4>
                            <span className="inline-block mt-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded uppercase tracking-wider">
                              {tag.status}
                            </span>
                          </div>
                          
                          {/* Compact Actions */}
                          <div className="flex items-center gap-1 shrink-0 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-0.5">
                            <button 
                              onClick={() => openEditTag(tag)} 
                              className="p-1.5 hover:bg-white dark:hover:bg-slate-850 rounded-md text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTag(tag.id)} 
                              className="p-1.5 hover:bg-white dark:hover:bg-slate-850 rounded-md text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Prices row */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-900 text-[11px]">
                          <div className="bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/50">
                            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Buy Price</p>
                            <p className="font-black text-slate-700 dark:text-slate-300 mt-0.5">৳{(tag.buyPrice || 0).toLocaleString()}</p>
                          </div>
                          <div className="bg-amber-50/30 dark:bg-amber-950/10 p-1.5 rounded-lg border border-amber-100/30 dark:border-amber-950/20">
                            <p className="text-amber-600/70 dark:text-amber-400/70 font-bold uppercase text-[9px] tracking-wider">Sell Price</p>
                            <p className="font-black text-amber-600 dark:text-amber-400 mt-0.5">৳{(tag.sellPrice || 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      <AnimatePresence>
        {isAddCategoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCategoryOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add New Category</h2>
                <button 
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category Name</label>
                  <input 
                    type="text" 
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="e.g. Hardwood"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddCategory}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Save Category
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Category Modal */}
      <AnimatePresence>
        {isEditCategoryOpen && editCategoryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditCategoryOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Category</h2>
                <button 
                  onClick={() => setIsEditCategoryOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category Name</label>
                  <input 
                    type="text" 
                    value={editCategoryData.name}
                    onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsEditCategoryOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateCategory}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Update Category
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Sub-Category Modal */}
      <AnimatePresence>
        {isAddSubCategoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddSubCategoryOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Car No</h2>
                <button 
                  onClick={() => setIsAddSubCategoryOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Parent Category</label>
                  <input 
                    type="text" 
                    value={activeCategory?.name || ''}
                    disabled
                    className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Car No Name</label>
                  <input 
                    type="text" 
                    value={newSubCategory.name}
                    onChange={(e) => {
                      setNewSubCategory({ ...newSubCategory, name: e.target.value });
                      detectInventoryCount(e.target.value);
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    placeholder="e.g. 1, 2, 3..."
                  />
                  {detectedInventoryCount > 0 && (
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                      <Check size={10} /> Auto-detected: {detectedInventoryCount} items already in inventory for this car no.
                    </p>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsAddSubCategoryOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddSubCategory}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Save Car No
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Sub-Category Modal */}
      <AnimatePresence>
        {isEditSubCategoryOpen && editSubCategoryData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditSubCategoryOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Car No</h2>
                <button 
                  onClick={() => setIsEditSubCategoryOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Car No Name</label>
                  <input 
                    type="text" 
                    value={editSubCategoryData.name}
                    onChange={(e) => {
                      setEditSubCategoryData({ ...editSubCategoryData, name: e.target.value });
                      detectInventoryCount(e.target.value);
                    }}
                    placeholder="e.g. 1, 2, 3..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                  />
                  {detectedInventoryCount > 0 && (
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                      <Check size={10} /> Auto-detected: {detectedInventoryCount} items in inventory.
                    </p>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsEditSubCategoryOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateSubCategory}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Update Car No
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Tag Modal */}
      <AnimatePresence>
        {isAddTagOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddTagOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add New Tag</h2>
                <button 
                  onClick={() => setIsAddTagOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tag Name</label>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                      placeholder="e.g. Set Price"
                    />
                    <div className="w-12 h-[42px] shrink-0">
                      <input 
                        type="color" 
                        value={newTag.color || '#3b82f6'}
                        onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                        className="w-full h-full p-0 border-0 rounded-xl cursor-pointer overflow-hidden"
                        title="Choose tag color"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Buy Price (৳)</label>
                    <input 
                      type="number" 
                      value={newTag.buyPrice}
                      onChange={(e) => setNewTag({ ...newTag, buyPrice: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Sell Price (৳)</label>
                    <input 
                      type="number" 
                      value={newTag.sellPrice}
                      onChange={(e) => setNewTag({ ...newTag, sellPrice: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsAddTagOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddTag}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Save Tag
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tag Modal */}
      <AnimatePresence>
        {isEditTagOpen && editTagData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditTagOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Tag</h2>
                <button 
                  onClick={() => setIsEditTagOpen(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Tag Name</label>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={editTagData.name}
                      onChange={(e) => setEditTagData({ ...editTagData, name: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    />
                    <div className="w-12 h-[42px] shrink-0">
                      <input 
                        type="color" 
                        value={editTagData.color || '#3b82f6'}
                        onChange={(e) => setEditTagData({ ...editTagData, color: e.target.value })}
                        className="w-full h-full p-0 border-0 rounded-xl cursor-pointer overflow-hidden"
                        title="Choose tag color"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Buy Price (৳)</label>
                    <input 
                      type="number" 
                      value={editTagData.buyPrice === 0 || editTagData.buyPrice === '0' ? '' : editTagData.buyPrice}
                      onChange={(e) => setEditTagData({ ...editTagData, buyPrice: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Sell Price (৳)</label>
                    <input 
                      type="number" 
                      value={editTagData.sellPrice === 0 || editTagData.sellPrice === '0' ? '' : editTagData.sellPrice}
                      onChange={(e) => setEditTagData({ ...editTagData, sellPrice: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setIsEditTagOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateTag}
                  className="px-4 py-2 text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-xl transition-colors shadow-lg shadow-amber-600/20"
                >
                  Update Tag
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Confirm Deletion</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Are you sure you want to delete this {deleteConfirmation.type === 'category' ? 'category' : 'Car No'}? This action cannot be undone.
                </p>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50">
                <button 
                  onClick={() => setDeleteConfirmation({ isOpen: false, type: null, id: null })}
                  className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl transition-colors shadow-lg shadow-rose-600/20 flex-1"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

export default function WoodCategoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <WoodCategoryPageContent />
    </Suspense>
  )
}
