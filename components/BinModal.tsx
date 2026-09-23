'use client'

import React, { useState, useEffect } from 'react'
import { Trash2, RotateCcw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { safeParse } from '@/lib/utils'

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface BinModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function BinModal({ isOpen, onClose }: BinModalProps) {
  const [binItems, setBinItems] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, ids: number[] }>({ isOpen: false, ids: [] });

  useEffect(() => {
    if (isOpen) {
      fetchBinItems()
    }
  }, [isOpen])

  const fetchBinItems = async () => {
    try {
      const { data, error } = await supabase
        .from('wood_inventory')
        .select('*')
        .eq('is_sold', true)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) {
        setBinItems(data.map(p => ({
          id: p.id,
          category: p.category,
          treeNo: p.tree_no,
          carNo: p.car_no
        })))
      }
    } catch (error) {
      console.error('Error fetching bin items:', error)
    }
  }

  const handleRestore = async (id: number) => {
    try {
      const { error } = await supabase
        .from('wood_inventory')
        .update({ is_sold: false })
        .eq('id', id)
      
      if (error) throw error
      toast.success('Item restored')
      fetchBinItems()
      window.dispatchEvent(new CustomEvent('wood-inventory-updated'))
    } catch (error: any) {
      console.error('Failed to restore item:', error)
      toast.error('Failed to restore: ' + error.message)
    }
  }

  const handlePermanentDelete = (ids: number[]) => {
    setDeleteConfirm({ isOpen: true, ids })
  }

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('wood_inventory')
        .delete()
        .in('id', deleteConfirm.ids)
      
      if (error) throw error
      
      toast.success('Items permanently deleted')
      setSelectedIds(selectedIds.filter(sid => !deleteConfirm.ids.includes(sid)))
      setDeleteConfirm({ isOpen: false, ids: [] })
      fetchBinItems()
      window.dispatchEvent(new CustomEvent('wood-inventory-updated'))
    } catch (error: any) {
      console.error('Failed to permanently delete items:', error)
      toast.error('Delete failed: ' + error.message)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === binItems.length && binItems.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(binItems.map(item => item.id))
    }
  }

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl p-6 space-y-6 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bin</h1>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">
                <X size={20} />
              </button>
            </div>
            
            {selectedIds.length > 0 && (
              <button 
                onClick={() => handlePermanentDelete(selectedIds)}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-all self-end"
              >
                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
              </button>
            )}

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-4 font-semibold">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === binItems.length && binItems.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                    </th>
                    <th className="px-4 py-4 font-semibold">Category</th>
                    <th className="px-4 py-4 font-semibold">Tree No</th>
                    <th className="px-4 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {binItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                      </td>
                      <td className="px-4 py-4">{item.category}</td>
                      <td className="px-4 py-4">{item.treeNo}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleRestore(item.id)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg">
                            <RotateCcw size={16} />
                          </button>
                          <button onClick={() => handlePermanentDelete([item.id])} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {deleteConfirm.isOpen && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
                      Are you sure you want to permanently delete {deleteConfirm.ids.length} item(s)? This action cannot be undone.
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
        </div>
      )}
    </AnimatePresence>
  )
}
