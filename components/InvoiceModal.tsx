'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Printer, FileText, Layout, Smartphone, Package, User, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import InvoicePrint from './InvoicePrint'
import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId, generateInvoicePreviewUrl } from '@/lib/invoice'
import { toast } from 'sonner'

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: any
}

export default function InvoiceModal({ isOpen, onClose, invoice }: InvoiceModalProps) {
  const [selectedSize, setSelectedSize] = useState<'A4' | 'A5' | 'POS' | 'Chalan'>('A4')
  const [zoom, setZoom] = useState(0.8)
  const containerRef = useRef<HTMLDivElement>(null)
  const [localInvoice, setLocalInvoice] = useState<any>(null)
  const [unscaledHeight, setUnscaledHeight] = useState(1123)
  const printableInvoiceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (invoice) {
      setLocalInvoice(invoice)
    } else {
      setLocalInvoice(null)
    }
  }, [invoice])

  useEffect(() => {
    if (!isOpen) return

    const measure = () => {
      if (printableInvoiceRef.current) {
        const height = printableInvoiceRef.current.scrollHeight || printableInvoiceRef.current.offsetHeight
        if (height > 0) {
          setUnscaledHeight(height)
        }
      }
    }

    measure()
    const t1 = setTimeout(measure, 100)
    const t2 = setTimeout(measure, 300)
    const t3 = setTimeout(measure, 600)

    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', measure)
    }
  }, [isOpen, selectedSize, zoom, localInvoice])

  useEffect(() => {
    if (!isOpen || !invoice?.id) return

    const fetchPayments = async () => {
      try {
        // Fetch matching 'Payment' transactions matching this invoice's ref
        const { data: paymentsData, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('ref', invoice.id)
          .gt('credit', 0)
          .order('id', { ascending: true })

        if (error) {
          console.error('Error fetching transactions:', error)
          return
        }

        const payments: any[] = paymentsData?.map(t => ({
          date: t.date,
          method: t.notes || 'Cash', // Try to use notes for method or fallback
          amount: Number(t.credit)
        })) || []

        const isWood = invoice.originalType?.toLowerCase() === 'wood' || 
                       invoice.originalType?.toLowerCase() === 'solo_wood' || 
                       invoice.type?.toLowerCase() === 'wood' || 
                       invoice.type?.toLowerCase() === 'solo_wood' ||
                       invoice.id?.includes('-W-')
        const invoiceTable = isWood ? 'wood_invoices' : 'furniture_invoices'

        // Fetch latest details from dynamic invoice table
        const { data: updatedInvoiceData } = await supabase
          .from(invoiceTable)
          .select('*')
          .eq('id', invoice.id)
          .single()

        const finalPaid = updatedInvoiceData ? Number(updatedInvoiceData.paid_amount || 0) : Number(invoice.paid || 0)
        const finalDue = updatedInvoiceData ? Number(updatedInvoiceData.due_amount || 0) : Number(invoice.due || 0)
        const finalTotal = updatedInvoiceData ? Number(updatedInvoiceData.total || 0) : Number(invoice.total || 0)

        // Ensure total payments match finalPaid
        const totalRecordedPayments = payments.reduce((sum, p) => sum + p.amount, 0)
        if (finalPaid > totalRecordedPayments) {
          payments.unshift({
            date: invoice.date || (updatedInvoiceData ? new Date(updatedInvoiceData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
            method: invoice.paymentMethod || 'Cash',
            amount: finalPaid - totalRecordedPayments
          })
        }

        // Sort payments chronologically date by date
        payments.sort((a, b) => {
          const tA = new Date(a.date).getTime()
          const tB = new Date(b.date).getTime()
          return tA - tB
        })

        // Fetch customer total_due if applicable
        let oldDue = invoice.oldDue || 0
        const customerName = updatedInvoiceData ? updatedInvoiceData.customer_name : invoice.customer
        if (customerName && customerName !== 'Walk-in Customer') {
          const { data: customerData } = await supabase
            .from('customer')
            .select('total_due')
            .eq('name', customerName)
            .single()
          
          if (customerData) {
            oldDue = Math.max(0, (customerData.total_due || 0) - finalDue)
          }
        }

        setLocalInvoice((prev: any) => ({
          ...(prev || invoice),
          paid: finalPaid,
          due: finalDue,
          total: finalTotal,
          oldDue,
          payments
        }))
      } catch (e) {
        console.error('Failed to sync payments of invoice preview:', e)
      }
    }

    fetchPayments()
  }, [isOpen, invoice?.id, invoice])

  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.clientWidth
    const padding = window.innerWidth >= 640 ? 64 : 32
    const availableWidth = containerWidth - padding
    
    let targetWidth = 794 // Default A4/Chalan
    if (selectedSize === 'A5') {
      targetWidth = 559 // 148mm
    } else if (selectedSize === 'POS') {
      targetWidth = 302 // 80mm
    }

    const fitScale = Math.min(1.0, Math.max(0.15, availableWidth / targetWidth))
    setZoom(Number(fitScale.toFixed(2)))
  }, [selectedSize])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        handleAutoFit()
      }, 150)

      const handleResize = () => {
        handleAutoFit()
      }

      window.addEventListener('resize', handleResize)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen, handleAutoFit])

  const handlePrint = () => {
    const content = document.getElementById('printable-invoice');
    if (!content) return;

    // Create an off-screen iframe with desktop viewport size so mobile browsers render standard desktop layouts
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = selectedSize === 'POS' ? '302px' : '1024px';
    iframe.style.height = '768px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Copy styles from the main document to ensure formatting is preserved
    let styles = '';
    try {
      const styleSheets = Array.from(document.styleSheets);
      styleSheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules);
          rules.forEach(rule => {
            styles += rule.cssText;
          });
        } catch (e) {
          // Ignore cross-origin stylesheet errors
        }
      });
    } catch (e) {
      console.error('Error copying styles:', e);
    }

    const rawInvoiceNumber = invoice.id ? getDisplayInvoiceId(invoice.id) : 'Invoice';
    const printTitle = `${selectedSize}-${rawInvoiceNumber}`;
    
    // Calculate actual height needed for POS
    const dynamicHeight = content.offsetHeight + 20; // Add 20px for some bottom padding

    doc.write(`
      <!DOCTYPE html>
      <html >
        <head>
          <title>${printTitle}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            ${styles}
            @media print {
              @page {
                size: ${selectedSize === 'POS' ? `80mm ${dynamicHeight}px` : (selectedSize === 'A5' ? 'A5' : 'A4')};
                margin: 0;
              }
              body { 
                margin: 0 !important; 
                padding: 0 !important;
                background: white !important;
                width: ${selectedSize === 'POS' ? '80mm' : 'auto'} !important;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              #printable-invoice { 
                box-shadow: none !important; 
                margin: 0 !important; 
                border: none !important;
                width: ${selectedSize === 'POS' ? '80mm' : '100%'} !important;
                max-width: none !important;
                transform: none !important;
                padding: ${selectedSize === 'POS' ? '0' : 'inherited'} !important;
              }
              tr, .break-inside-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            }
          </style>
        </head>
        <body>
          <div id="printable-invoice">
            ${content.innerHTML}
          </div>
        </body>
      </html >
    `);
    doc.close();

    const triggerPrint = () => {
      // Check for direct Android native print bridge
      if (typeof window !== 'undefined' && (window as any).AndroidPrint) {
        try {
          const fullHtml = doc.documentElement ? doc.documentElement.outerHTML : '';
          if (fullHtml && typeof (window as any).AndroidPrint.printHtml === 'function') {
            (window as any).AndroidPrint.printHtml(fullHtml, printTitle);
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
            return;
          }
        } catch (e) {
          console.warn('AndroidPrint bridge error:', e);
        }
      }

      if (iframe.contentWindow) {
        const originalTitle = document.title;
        document.title = printTitle;

        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn('Print not supported', e);
        }
        
        // Remove the iframe and restore title after printing is initiated
        setTimeout(() => {
          document.title = originalTitle;
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    };

    // Safely wait for all print images (such as the logo) to complete loading
    const images = Array.from(doc.getElementsByTagName('img'));
    let loadedCount = 0;
    const totalImages = images.length;

    if (totalImages === 0) {
      setTimeout(triggerPrint, 500);
    } else {
      const timeoutId = setTimeout(triggerPrint, 3000); // 3 seconds safety fallback trigger

      images.forEach((img) => {
        if (img.complete) {
          loadedCount++;
          if (loadedCount === totalImages) {
            clearTimeout(timeoutId);
            setTimeout(triggerPrint, 300);
          }
        } else {
          img.onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              clearTimeout(timeoutId);
              setTimeout(triggerPrint, 300);
            }
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
              clearTimeout(timeoutId);
              setTimeout(triggerPrint, 300);
            }
          };
        }
      });
    }
  }

  const handleShareLink = () => {
    if (!invoice) return;
    const url = generateInvoicePreviewUrl(invoice);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Invoice preview link copied to clipboard!');
      }).catch(() => {
        toast.error('Failed to copy link.');
      });
    }
  };

  if (!invoice) return null

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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-full sm:h-[95vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">Invoice Preview</h2>
                  {invoice?.createdBy && invoice.createdBy !== 'Unassigned' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                      <User size={12} className="text-slate-400" />
                      Created by: <strong className="text-slate-800 dark:text-slate-200">{invoice.createdBy}</strong>
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Select format and print your invoice</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            {/* Controls */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 sm:gap-2 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                <button 
                  onClick={() => setSelectedSize('A4')}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-sm font-bold transition-all",
                    selectedSize === 'A4' ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <FileText size={16} className="sm:w-[18px]" /> A4
                </button>
                <button 
                  onClick={() => setSelectedSize('A5')}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-sm font-bold transition-all",
                    selectedSize === 'A5' ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Layout size={16} className="sm:w-[18px]" /> A5
                </button>
                <button 
                  onClick={() => setSelectedSize('POS')}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-sm font-bold transition-all",
                    selectedSize === 'POS' ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Smartphone size={16} className="sm:w-[18px]" /> POS
                </button>
                <button 
                  onClick={() => setSelectedSize('Chalan')}
                  className={cn(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[12px] sm:text-sm font-bold transition-all",
                    selectedSize === 'Chalan' ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <Package size={16} className="sm:w-[18px]" /> Chalan
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto justify-center sm:justify-end">
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                    className="px-2 sm:px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    -
                  </button>
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-slate-300 w-10 sm:w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
                    className="px-2 sm:px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    +
                  </button>
                  <button 
                    onClick={handleAutoFit}
                    title="Auto Fit to Screen"
                    className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-amber-200 dark:border-amber-900/50"
                  >
                    Auto Fit
                  </button>
                </div>
                <button 
                  onClick={handleShareLink}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all text-xs sm:text-sm cursor-pointer"
                  title="Copy Unique Preview URL"
                >
                  <Share2 size={16} /> Share Link
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-lg shadow-slate-900/20"
                >
                  <Printer size={18} /> Print
                </button>
              </div>
            </div>

            {/* Preview Area */}
            {(() => {
              let originalWidth = 794
              if (selectedSize === 'A5') {
                originalWidth = 559
              } else if (selectedSize === 'POS') {
                originalWidth = 302
              }

              return (
                <div 
                  ref={containerRef} 
                  className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 scrollbar-thin overscroll-contain touch-auto"
                >
                  <div className="min-w-max min-h-max flex items-start justify-center p-2">
                    <div 
                      style={{ 
                        width: `${originalWidth * zoom}px`, 
                        height: `${unscaledHeight * zoom}px`,
                        overflow: 'hidden',
                        position: 'relative'
                      }} 
                      className="transition-all duration-200 shadow-2xl rounded-lg bg-white"
                    >
                      <div 
                        style={{ 
                          transform: `scale(${zoom})`, 
                          transformOrigin: 'top left',
                          width: `${originalWidth}px`,
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }} 
                        className="h-fit"
                      >
                        <div ref={printableInvoiceRef} id="printable-invoice" className="h-fit">
                          <InvoicePrint invoice={localInvoice || invoice} size={selectedSize} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
