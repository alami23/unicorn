'use client'

import React, { useState, useEffect, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, Trash2, Edit2, Armchair, X, Loader2, Box, Sparkles, Filter, CheckCircle2, HelpCircle, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { addNotification } from '@/lib/notifications'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'

interface FurnitureCategory {
  id: string
  name: string
  description: string
  size: string
  status: string
  created_at?: string
}

function FurnitureCategoryPageContent() {
  const [categories, setCategories] = useState<FurnitureCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FurnitureCategory | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    size: 'Standard',
    status: 'Active'
  })

  const fetchCategories = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data: cats, error: catsError } = await supabase
        .from('furniture_category')
        .select('*')
        .order('name', { ascending: true })

      if (catsError) throw catsError
      setCategories(cats || [])
    } catch (error: any) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const handleOpenModal = (cat?: FurnitureCategory) => {
    if (cat) {
      setEditingCategory(cat)
      setFormData({
        name: cat.name,
        description: cat.description || '',
        size: cat.size || 'Standard',
        status: cat.status || 'Active'
      })
    } else {
      setEditingCategory(null)
      setFormData({
        name: '',
        description: '',
        size: 'Standard',
        status: 'Active'
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('Category name is required')
      return
    }

    setSaving(true)
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('furniture_category')
          .update({
            name: formData.name,
            description: formData.description,
            size: formData.size,
            status: formData.status
          })
          .eq('id', editingCategory.id)

        if (error) throw error
        addNotification('inventory_update', 'Category Updated', `Category ${formData.name} was updated.`);
        toast.success('Category updated successfully')
      } else {
        const id = 'CAT-' + Math.random().toString(36).substr(2, 9).toUpperCase()
        const { error } = await supabase
          .from('furniture_category')
          .insert([{
            id,
            name: formData.name,
            description: formData.description,
            size: formData.size,
            status: formData.status
          }])

        if (error) throw error
        addNotification('inventory_update', 'Category Added', `Category ${formData.name} was added.`);
        toast.success('Category added successfully')
      }
      setIsModalOpen(false)
      fetchCategories()
    } catch (error: any) {
      console.error('Save error:', error)
      toast.error(error.message || 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!categoryToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('furniture_category')
        .delete()
        .eq('id', categoryToDelete)

      if (error) throw error
      toast.success('Category deleted')
      setIsDeleteModalOpen(false)
      fetchCategories()
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error('Failed to delete category')
    } finally {
      setDeleting(false)
      setCategoryToDelete(null)
    }
  }

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalCategories = categories.length
  const activeCount = categories.filter(c => c.status === 'Active').length
  const inactiveCount = totalCategories - activeCount

  return (
    <DashboardLayout>
      <div className="space-y-8 flex flex-col h-auto">
        {/* Header & Stats */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100 mt-0 mb-[25px]">Furniture Categories</h1>
          </div>
          
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto -mt-[35px] sm:mt-0">
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                <Box size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-wider truncate">Total</p>
                <p className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-none mt-0.5">{totalCategories}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-600/70 dark:text-emerald-400/70 tracking-wider truncate">Active</p>
                <p className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">{activeCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <HelpCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider truncate">Inactive</p>
                <p className="text-base sm:text-xl font-bold text-slate-700 dark:text-slate-300 leading-none mt-0.5">{inactiveCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm -mt-[10px] sm:mt-0">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                  viewMode === 'grid'
                    ? "bg-white dark:bg-slate-700 text-amber-600 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center",
                  viewMode === 'list'
                    ? "bg-white dark:bg-slate-700 text-amber-600 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="List view"
              >
                <List size={16} />
              </button>
            </div>

            <button 
              onClick={() => handleOpenModal()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-600/20 transition-all cursor-pointer"
            >
              <Plus size={18} />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className="relative min-h-[400px]">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-amber-600" />
                <span className="text-sm font-bold text-slate-500">Loading categories...</span>
              </div>
            </div>
          ) : filteredCategories.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredCategories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-xl border p-3 flex flex-col justify-between hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all group",
                      cat.status === 'Inactive' ? "border-slate-200 dark:border-slate-800 opacity-75 grayscale-[0.5]" : "border-slate-200 dark:border-slate-800 shadow-sm"
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          cat.status === 'Active' 
                            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        )}>
                          <Armchair size={18} strokeWidth={1.5} />
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                          cat.status === 'Active'
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        )}>
                          {cat.status}
                        </span>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base group-hover:text-amber-600 transition-colors truncate">{cat.name}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-mono mt-0.5">{cat.id}</p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 min-h-[32px]">
                        {cat.description || <span className="italic opacity-60">No description provided.</span>}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-1.5 shrink-0 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(cat)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all"
                        title="Edit Category"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => { setCategoryToDelete(cat.id); setIsDeleteModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredCategories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/5 transition-all group",
                      cat.status === 'Inactive' ? "border-slate-200 dark:border-slate-800 opacity-75 grayscale-[0.5]" : "border-slate-200 dark:border-slate-800 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors hidden sm:flex",
                        cat.status === 'Active' 
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500" 
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>
                        <Armchair size={18} strokeWidth={1.5} />
                      </div>
                      
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center">
                        <div className="sm:col-span-4 min-w-0">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-amber-600 transition-colors truncate">{cat.name}</h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-mono">{cat.id}</p>
                        </div>
                        <div className="sm:col-span-6 min-w-0">
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed truncate">
                            {cat.description || <span className="italic opacity-60">No description provided.</span>}
                          </p>
                        </div>
                        <div className="sm:col-span-2 flex sm:justify-end">
                           <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                            cat.status === 'Active'
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          )}>
                            {cat.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 pt-2 sm:pt-0 sm:pl-3 sm:border-l transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(cat)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg transition-all"
                        title="Edit Category"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => { setCategoryToDelete(cat.id); setIsDeleteModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 border-dashed dark:border-slate-800 rounded-3xl py-24 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Box size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No Categories Found</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed mb-6">
                You haven&apos;t added any furniture categories yet, or none match your search.
              </p>
              <button 
                onClick={() => handleOpenModal()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 active:scale-95 transition-all"
              >
                <Plus size={18} />
                <span>Create First Category</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
                      {editingCategory ? <Edit2 size={24} strokeWidth={1.5} /> : <Plus size={24} strokeWidth={1.5} />}
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                        {editingCategory ? 'Edit Category' : 'Create Category'}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {editingCategory ? 'Update category details below' : 'Add a new category classification'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all bg-slate-50 dark:bg-slate-800/50"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Category Name</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all text-sm"
                      placeholder="e.g. Bed, Sofa, Dining"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Description <span className="font-normal text-slate-400">(Optional)</span></label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 dark:text-slate-100 transition-all min-h-[100px] text-sm resize-none leading-relaxed"
                      placeholder="Explain what items fall under this category..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Status</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                      {['Active', 'Inactive'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({ ...formData, status: s })}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-bold rounded-lg transition-all",
                            formData.status === s
                              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Category Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleting && setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600 dark:text-rose-500">
                <Trash2 size={32} strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">Delete Category?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                Are you sure you want to delete this category? Any products assigned to this category might lose their classification. This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}

export default function FurnitureCategoryPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    }>
      <FurnitureCategoryPageContent />
    </Suspense>
  )
}
