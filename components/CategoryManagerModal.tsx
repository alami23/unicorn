'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Tag, Save, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  categories: string[]
  initialCategories: string[]
  onUpdate: (updatedCategories: string[]) => void
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  initialCategories,
  onUpdate
}: CategoryManagerModalProps) {
  const [newCategory, setNewCategory] = useState('')
  const [editingIndex, setEditingCategoryIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const handleAdd = () => {
    const trimmed = newCategory.trim()
    if (!trimmed) return

    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Category already exists')
      return
    }

    const updated = [...categories, trimmed]
    onUpdate(updated)
    setNewCategory('')
    toast.success('Category added')
  }

  const handleEdit = (index: number) => {
    setEditingCategoryIndex(index)
    setEditingValue(categories[index])
  }

  const handleSaveEdit = () => {
    const trimmed = editingValue.trim()
    if (!trimmed || editingIndex === null) return

    if (categories.some((c, i) => i !== editingIndex && c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Another category already has this name')
      return
    }

    const updated = [...categories]
    updated[editingIndex] = trimmed
    onUpdate(updated)
    setEditingCategoryIndex(null)
    setEditingValue('')
    toast.success('Category updated')
  }

  const handleDelete = (index: number) => {
    const categoryName = categories[index]
    if (initialCategories.includes(categoryName)) {
      toast.error('Cannot delete system category')
      return
    }
    setDeleteIndex(index)
  }

  const confirmDelete = () => {
    if (deleteIndex === null) return
    const updated = categories.filter((_, i) => i !== deleteIndex)
    onUpdate(updated)
    setDeleteIndex(null)
    toast.success('Category deleted')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Tag size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Category Manager
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage expense and bill categories
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Add New Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Add New Category
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Office Supplies"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newCategory.trim()}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Category List */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Existing Categories
                </label>
                <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {categories.map((cat, index) => (
                    <div
                      key={`${cat}-${index}`}
                      className="group flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl hover:border-indigo-500/30 transition-all"
                    >
                      {editingIndex === index ? (
                        <div className="flex-1 flex gap-2 mr-2">
                          <input
                            autoFocus
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-indigo-500/30 rounded-lg outline-none text-sm font-medium"
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingCategoryIndex(null)}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {cat}
                              {initialCategories.includes(cat) && (
                                <span className="ml-2 text-[10px] text-slate-400 font-normal italic">(System)</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(index)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(index)}
                              disabled={initialCategories.includes(cat)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                initialCategories.includes(cat)
                                  ? "text-slate-200 dark:text-slate-800 cursor-not-allowed"
                                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              )}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:opacity-90 transition-all active:scale-95"
              >
                Close Manager
              </button>
            </div>

            {/* Delete Confirmation Overlay */}
            <AnimatePresence>
              {deleteIndex !== null && (
                <div className="absolute inset-0 z-[160] flex items-center justify-center p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center"
                  >
                    <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <AlertCircle size={24} />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Delete Category?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                      Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-slate-200">&quot;{categories[deleteIndex]}&quot;</span>?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteIndex(null)}
                        className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDelete}
                        className="flex-1 px-4 py-2 text-sm font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
