const fs = require('fs');

let code = fs.readFileSync('app/invoice/page.tsx', 'utf8');

// Replace state variables to add page and hasMore
code = code.replace(
  "const [isFetchingItems, setIsFetchingItems] = useState(false)",
  `const [isFetchingItems, setIsFetchingItems] = useState(false)\n  const [page, setPage] = useState(0)\n  const [hasMore, setHasMore] = useState(true)\n  const [isLoadingMore, setIsLoadingMore] = useState(false)`
);

// Replace loadInvoices function
const loadInvoicesReplacement = `
  const loadInvoices = async (resetPage = false) => {
    const currentPage = resetPage ? 0 : page
    if (resetPage) {
      setIsLoading(true)
      setPage(0)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const limit = currentPage === 0 ? 12 : 10
      const start = currentPage === 0 ? 0 : 12 + (currentPage - 1) * 10
      const end = start + limit - 1

      let query = supabase
        .from('invoices')
        .select('*, customer(photo)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.or(\`id.ilike.%\${searchTerm}%,customer_name.ilike.%\${searchTerm}%\`)
      }

      if (typeFilter) {
        query = query.eq('type', typeFilter === 'Wood' ? 'solo_wood' : typeFilter)
      }

      if (selectedStatusFilter !== 'All') {
        if (selectedStatusFilter === 'Paid') {
          query = query.eq('due_amount', 0)
        } else if (selectedStatusFilter === 'Partial') {
          query = query.gt('paid_amount', 0).gt('due_amount', 0)
        } else if (selectedStatusFilter === 'Due') {
          query = query.eq('paid_amount', 0).gt('due_amount', 0)
        }
      }

      if (selectedDateRange !== 'All time') {
        const now = new Date()
        if (selectedDateRange === 'Today') {
          const startOfDay = new Date(now.setHours(0,0,0,0)).toISOString()
          const endOfDay = new Date(now.setHours(23,59,59,999)).toISOString()
          query = query.gte('created_at', startOfDay).lte('created_at', endOfDay)
        } else if (selectedDateRange === 'Last 7 Days') {
          const start = new Date(now)
          start.setDate(now.getDate() - 7)
          start.setHours(0,0,0,0)
          query = query.gte('created_at', start.toISOString())
        } else if (selectedDateRange === 'This Month') {
          const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
          query = query.gte('created_at', start).lte('created_at', end)
        } else if (selectedDateRange === 'Custom') {
          if (startDate) query = query.gte('created_at', new Date(startDate).toISOString())
          if (endDate) {
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            query = query.lte('created_at', end.toISOString())
          }
        }
      }

      query = query.range(start, end)

      const { data, error, count } = await query
      
      if (error) throw error
      
      if (data) {
        const formattedData = data.map(inv => ({
          id: inv.id,
          customer: inv.customer_name,
          customerPhone: inv.customer_phone,
          customerPhoto: inv.customer?.photo,
          customerAddress: inv.customer_address,
          date: new Date(inv.created_at).toISOString().split('T')[0],
          amount: Number(inv.total),
          paid: Number(inv.paid_amount),
          due: Number(inv.due_amount),
          status: Number(inv.due_amount) === 0 ? 'Paid' : (Number(inv.paid_amount) > 0 ? 'Partial' : 'Due'),
          type: inv.type === 'solo_wood' ? 'Wood' : inv.type,
          originalType: inv.type,
          discount: Number(inv.discount),
          deliveryCharge: Number(inv.delivery_charge),
          deliveryDate: inv.delivery_date,
          items: inv.items
        }))

        if (resetPage) {
          setInvoices(formattedData)
        } else {
          setInvoices(prev => {
             // Deduplicate just in case
             const existingIds = new Set(prev.map(p => p.id));
             return [...prev, ...formattedData.filter(f => !existingIds.has(f.id))]
          })
        }
        
        setHasMore(count ? start + data.length < count : false)
        if (!resetPage && data.length > 0) setPage(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
      toast.error('Failed to load invoices')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  // Use a ref to debounce the search term effect
  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, typeFilter, selectedStatusFilter, selectedDateRange, startDate, endDate, customerFilter])

  // Handle scroll for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop + 100 >= document.documentElement.offsetHeight) {
        if (!isLoading && !isLoadingMore && hasMore) {
          loadInvoices()
        }
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isLoading, isLoadingMore, hasMore, page])
`;

// Find `const loadInvoices = async () => {`
const loadInvoicesStart = code.indexOf("  const loadInvoices = async () => {");
if (loadInvoicesStart === -1) {
  console.log("Failed to find loadInvoices!");
  process.exit(1);
}

// Find the end of `loadInvoices` and the existing `useEffect`
const loadInvoicesEnd = code.indexOf("  const handleSendInvoice = async (inv: any) => {");

if (loadInvoicesEnd === -1) {
  console.log("Failed to find end of loadInvoices!");
  process.exit(1);
}

// Replace
code = code.substring(0, loadInvoicesStart) + loadInvoicesReplacement + '\n' + code.substring(loadInvoicesEnd);

// Remove in-memory filtering
const filterStart = code.indexOf("  const filteredInvoices = invoices.filter(inv => {");
const filterEnd = code.indexOf("    return matchesSearch && matchesType && matchesStatus && matchesDate\n  })");

if (filterStart !== -1 && filterEnd !== -1) {
  code = code.substring(0, filterStart) + "  const filteredInvoices = invoices;" + code.substring(filterEnd + "    return matchesSearch && matchesType && matchesStatus && matchesDate\n  })".length);
} else {
  console.log("Failed to find filteredInvoices block");
  process.exit(1);
}

// Replace loading more indicator at the end
code = code.replace(
  "</div>\n        </div>\n\n        <InvoiceModal",
  `</div>\n        </div>\n\n        {isLoadingMore && (\n          <div className="py-6 flex justify-center">\n            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>\n          </div>\n        )}\n\n        <InvoiceModal`
)

// Update handleDeleteInvoice, receivePaymentModal onSave, etc. to loadInvoices(true)
code = code.replace(
  "setInvoiceToDelete(null)\n      loadInvoices()",
  "setInvoiceToDelete(null)\n      loadInvoices(true)"
);

code = code.replace(
  "toast.success('Payment received')\n              addNotification('invoice_update', 'Payment Received', `Received ৳${payment.amount} for Invoice ${selectedInvoice.id} via ${payment.method}`);\n              loadInvoices()",
  "toast.success('Payment received')\n              addNotification('invoice_update', 'Payment Received', `Received ৳\${payment.amount} for Invoice \${selectedInvoice.id} via \${payment.method}`);\n              loadInvoices(true)"
);

code = code.replace(
  "onSave={loadInvoices}",
  "onSave={() => loadInvoices(true)}"
);

fs.writeFileSync('app/invoice/page.tsx', code);
console.log("Done");
