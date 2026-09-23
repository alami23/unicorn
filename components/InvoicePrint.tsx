'use client'

import React, { useState, useEffect } from 'react'
import QRCode from "react-qr-code"
import { cn, parseDateSafe } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getDisplayInvoiceId } from '@/lib/invoice'

interface InvoicePrintProps {
  invoice: any
  size: 'A4' | 'A5' | 'POS' | 'Chalan'
}

export default function InvoicePrint({ invoice, size }: InvoicePrintProps) {
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('settings')
          .eq('id', 'global')
          .single()
        
        if (data && data.settings) {
          setSettings(data.settings)
        }
      } catch (e) {
        console.error('Failed to fetch settings from Supabase', e)
      }
    }
    fetchSettings()
  }, [])

  if (!invoice) return null

  let currentUserId = null;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('custom_user');
      if (stored) {
        currentUserId = JSON.parse(stored).id;
      }
    } catch (e) {}
  }

  const userBiz = currentUserId ? settings?.business_by_user?.[currentUserId] : null;
  const business = (userBiz && userBiz.name) ? userBiz : (settings?.business || invoice?.business || {
    name: '',
    address: '',
    email: '',
    phone: '',
    logo: ''
  });

  const isPOS = size?.toLowerCase() === 'pos'
  const isA5 = size?.toLowerCase() === 'a5'
  const isChalan = size?.toLowerCase() === 'chalan'
  const isA4 = size?.toLowerCase() === 'a4' || isChalan 
  const isStandardPage = isA4 || isA5 

  const isWood = invoice.type?.toLowerCase() === 'wood' || 
                 invoice.type?.toLowerCase() === 'solo_wood' || 
                 invoice.originalType?.toLowerCase() === 'solo_wood' || 
                 invoice.original_type?.toLowerCase() === 'solo_wood'

  const showPaymentData = !isChalan ? true : (isWood ? Boolean(settings?.finance?.showPaymentOnChalan) : false)

  const formatTagDisplay = (tag: any) => {
    if (!tag) return '-'
    const str = String(tag).trim()
    if (!str || str.toUpperCase() === 'NO TAG' || str.toUpperCase() === 'NO_TAG' || str === '-') return '-'
    return str
  }

  let items = Array.isArray(invoice.items) ? invoice.items.map((item: any) => {
    const rawCft = (item.cft !== undefined && item.cft !== null) ? Number(item.cft) : Number(item.quantity);
    return {
      ...item,
      treeNo: item.treeNo || item.tree_no || (isWood ? item.name : undefined),
      carNo: item.carNo || item.car_no,
      sellPrice: item.sellPrice || item.price,
      cft: isNaN(rawCft) ? 0 : rawCft,
      width: item.width !== undefined && item.width !== null ? Number(item.width) : 0,
      length: item.length !== undefined && item.length !== null ? Number(item.length) : 0,
      tag: formatTagDisplay(item.tag),
    }
  }) : []

  const isSoloWood = invoice.type?.toLowerCase() === 'solo_wood' || 
                     invoice.originalType?.toLowerCase() === 'solo_wood' || 
                     invoice.original_type?.toLowerCase() === 'solo_wood'

  if (isSoloWood) {
    items = [...items].reverse();
  }
  const itemsSubtotal = items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
  const discountAmount = Math.round(invoice.discountType === 'percent' 
    ? (itemsSubtotal * (invoice.discount || 0) / 100) 
    : (invoice.discount || 0))
  const totalOrderAmount = Math.round(itemsSubtotal - discountAmount + (invoice.deliveryCharge || 0))


  // Helper to format date
  const formatDate = (dateStr: string) => {
    try {
      const date = parseDateSafe(dateStr)
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch (e) {
      return dateStr
    }
  }

  const capitalizeMethod = (method: string) => {
    if (!method) return 'Cash'
    return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()
  }

  if (isPOS) {
    return (
      <div className="w-[80mm] bg-white text-black font-sans p-[12px] flex flex-col shadow-sm print:shadow-none mx-auto" style={{ fontSize: '10px' }}>
        {/* Business Header */}
        <div className="flex flex-col items-center text-center mb-[4px]">
          {business.name && (
            <h1 className="text-[18px] font-black tracking-tight leading-[1] mb-[2px] uppercase text-black">
              {business.name}
            </h1>
          )}
          <div className="text-[9px] text-black font-medium leading-[1.2] whitespace-pre-wrap text-center">
            {business.address && <p>{business.address}</p>}
            {business.phone && <p>Mobile: {business.phone}{business.secondaryPhone ? `, ${business.secondaryPhone}` : ''}</p>}
          </div>
        </div>

        <div className="border-t-[1.5px] border-black mt-[4px] pt-[4px] text-center">
          <p className="font-black uppercase text-[12px] leading-[1] text-black mb-[4px]">{isChalan ? 'CHALAN' : 'INVOICE'}</p>
        </div>
        <div className="border-t-[1.5px] border-black mb-[8px]" />

        <div className="flex justify-between items-start mb-[12px] text-black gap-[8px]">
          <div className="text-[10px] max-w-[50%] leading-[1.3]">
            <p className="font-black uppercase mb-[2px]">Customer</p>
            <p className="font-bold whitespace-pre-wrap">{invoice.customer}</p>
            {invoice.customerPhone && <p className="font-bold">{invoice.customerPhone}</p>}
            {invoice.customerAddress && <p>{invoice.customerAddress}</p>}
          </div>
          <div className="text-[10px] text-right leading-[1.3]">
            <p className="whitespace-nowrap font-bold"><span className="font-black">{isChalan ? 'Chalan ID:' : 'Invoice ID:'}</span> {getDisplayInvoiceId(invoice.id)}</p>
            <p className="whitespace-nowrap font-bold"><span className="font-black">{isChalan ? 'Chalan Date:' : 'Invoice Date:'}</span> {formatDate(isChalan ? new Date().toISOString() : invoice.date)}</p>
            {(invoice.deliveryDate || invoice.delivery_date) && !isWood && <p className="whitespace-nowrap font-bold"><span className="font-black">Delivery Date:</span> {formatDate(invoice.deliveryDate || invoice.delivery_date)}</p>}
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-[12px] border-collapse text-black">
          <thead>
            <tr className="border-y-[1.5px] border-black text-[10px] uppercase font-black leading-[1]">
              <th className="py-[6px] text-center w-[24px]">NO</th>
              {isWood && <th className="py-[6px] text-center w-[24px]">CAR</th>}
              <th className="py-[6px] text-left pl-[4px]">{isWood ? '( TREE - W - L ) = SIZE' : 'Description'}</th>
              {!isWood && <th className="py-[6px] text-center w-[32px]">QTY</th>}
              {isWood ? <th className="py-[6px] text-center w-[28px]">TAG</th> : <th className="py-[6px] text-right w-[48px]">PRICE</th>}
              <th className="py-[6px] text-right w-[56px]">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={`pos-item-${idx}`} className="text-[10px] border-b-[1px] border-slate-200 last:border-b-0 text-black leading-[1.2]">
                <td className="py-[8px] text-center font-bold align-top">{idx + 1}</td>
                {isWood && <td className="py-[8px] text-center font-bold align-top">{item.treeNo?.startsWith('M-') ? 'M' : (item.carNo || '-')}</td>}
                <td className="py-[8px] pr-[4px] pl-[4px] align-top">
                  <span className="font-bold">
                    {isWood 
                      ? `( ${item.treeNo || '-'} - ${item.width || 0}" - ${item.length || 0}' ) = ${item.cft?.toFixed(4) || 0}` 
                      : item.name}
                  </span>
                </td>
                {!isWood && (
                  <td className="py-[8px] text-center text-black font-bold text-[10px] align-top">
                    {item.quantity || 1} {item.unit || 'PCS'}
                  </td>
                )}
                {isWood ? (
                  <td className="py-[8px] text-center font-bold text-black uppercase align-top">{formatTagDisplay(item.tag)}</td>
                ) : (
                  <td className="py-[8px] text-right font-bold text-black uppercase align-top">৳{Number(item.price || 0).toLocaleString()}</td>
                )}
                <td className="py-[8px] text-right font-black text-black align-top">
                  ৳{Number(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="w-full text-black flex flex-col gap-[4px] mt-[8px]">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span>Subtotal:</span>
            <span className="font-bold">৳{Math.round(itemsSubtotal || 0).toLocaleString()}</span>
          </div>

          {invoice.discount > 0 && (
            <div className="flex justify-between items-center text-[10px] font-black">
              <span>{invoice.discountType === 'percent' ? `Discount (${invoice.discount}%)` : 'Discount'}:</span>
              <span>-৳{Math.round(discountAmount || 0).toLocaleString()}</span>
            </div>
          )}

          {invoice.deliveryCharge > 0 && (
            <div className="flex justify-between items-center text-[10px] font-bold">
              <span>Delivery:</span>
              <span>৳{Math.round(invoice.deliveryCharge || 0).toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between items-center border-[1.5px] border-b-0 border-r-0 border-l-0 border-black pt-[4px]">
            <span className="font-black text-[12px] uppercase">TOTAL:</span>
            <span className="font-black text-[14px] leading-[1]">৳{Math.round(totalOrderAmount || 0).toLocaleString()}</span>
          </div>

          {invoice.payments && invoice.payments.length > 0 ? (
            invoice.payments.map((p: any, i: number) => (
              <div key={`payment-pos-${i}`} className="flex justify-between items-center pt-[4px] font-black border-t-[1.5px] border-black text-black print:text-black">
                <span className="text-[10px] normal-case text-black">Payment On {formatDate(p.date)} ({capitalizeMethod(p.method)}) :</span>
                <span className="text-[12px] text-black print:text-black">৳{Math.round(p.amount || 0).toLocaleString()}</span>
              </div>
            ))
          ) : (invoice.paid || 0) > 0 && (
            <div className="flex justify-between items-center pt-[4px] font-black border-[1.5px] border-b-0 border-r-0 border-l-0 border-black text-black print:text-black">
              <span className="text-[10px] normal-case text-black">Payment On {formatDate(invoice.date)} ({capitalizeMethod(invoice.paymentMethod)}) :</span>
              <span className="text-[12px] text-black print:text-black">৳{Math.round(invoice.paid || 0).toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-[4px] font-black border-[1.5px] border-b-0 border-r-0 border-l-0 border-black text-black print:text-black">
            <span className="text-[12px] uppercase text-black print:text-black">DUE AMOUNT:</span>
            <span className="text-[14px] text-black print:text-black">৳{Math.round(invoice.due || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Due Summary Section */}
        <div className="border-t-[1.5px] border-dashed border-black pt-[12px] mt-[16px] text-black">
          <div className="flex flex-col gap-[4px]">
            <div className="flex justify-between items-center text-[10px] font-black">
              <span>Previous Due:</span>
              <span>৳{Math.round(invoice.oldDue || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black">
              <span>Current Due:</span>
              <span>৳{Math.round(invoice.due || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center border-t-[1.5px] border-dotted border-black pt-[4px]">
              <span className="font-black text-[12px] uppercase">TOTAL DUE:</span>
              <span className="font-black text-[14px]">৳{Math.round((invoice.oldDue || 0) + (invoice.due || 0)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="flex flex-col items-center justify-center mt-[11px] mb-[-30px]">
          <QRCode 
            value={getDisplayInvoiceId(invoice.id)} 
            size={60}
            style={{ height: "auto", maxWidth: "100%", width: "60px" }}
            viewBox={`0 0 256 256`}
          />
        </div>

        {/* Footer Area */}
        <div className="mt-[36px] mb-0 h-[150px] text-center pt-[16px] border-[1px] border-b-0 border-r-0 border-l-0 border-slate-200">
          <p className="text-[10px] text-black font-bold mt-[-11px] mb-[3px]">Thank you for your business!</p>
          <p className="text-[9px] text-black mb-[48px]">Please keep this invoice for your records.</p>
          
          <div className="w-full flex justify-between gap-[16px] px-[8px]">
            <div className="flex flex-col items-center flex-1 mt-[38px] h-[18px]">
              <div className="w-full border-t-[1.5px] border-black mb-[4px]" />
              <p className="text-[9px] font-black text-black uppercase">CUSTOMER SIGNATURE</p>
            </div>
            <div className="flex flex-col items-center flex-1 mt-[38px] h-[18px] mb-0">
              <div className="w-full border-t-[1.5px] border-black mb-[4px]" />
              <p className="text-[9px] font-black text-black uppercase">AUTHORIZED SIGNATURE</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isStandardPage) {
    const halfItems = Math.ceil(items.length / 2);
    
    const leftRealItems = items.slice(0, halfItems).map((item: any, idx: number) => ({ ...item, globalIndex: idx }));
    const rightRealItems = items.slice(halfItems).map((item: any, idx: number) => ({ ...item, globalIndex: halfItems + idx }));
    
    const maxLength = Math.max(leftRealItems.length, rightRealItems.length);
    const leftTableItems = [
      ...leftRealItems,
      ...Array(Math.max(0, maxLength - leftRealItems.length)).fill({ isEmpty: true })
    ];
    const rightTableItems = [
      ...rightRealItems,
      ...Array(Math.max(0, maxLength - rightRealItems.length)).fill({ isEmpty: true })
    ];

    const renderTable = (tableItems: any[]) => {
      if (!tableItems || tableItems.length === 0) return null;
      
      return (
        <table className="w-full border-collapse border-[1.5px] border-black text-black">
          <thead>
            <tr className={cn(
              "font-black uppercase border-b-[1.5px] border-black bg-black text-white print:bg-black print:text-white print:-webkit-print-color-adjust-exact",
              isA5 ? "text-[8.5px]" : "text-[12px]"
            )}>
              <th className={cn("py-[1px] text-center", isA5 ? "w-[22px]" : "w-[32px]")}>NO</th>
              {isWood ? (
                <>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[22px]" : "w-[32px]")}>CAR</th>
                  <th className="py-[1px] text-center">( TREE - W - L ) = SIZE</th>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[28px]" : "w-[40px]")}>TAG</th>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[56px]" : "w-[80px]")}>TOTAL</th>
                </>
              ) : (
                <>
                  <th className="py-[1px] text-center">ITEM</th>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[68px]" : "w-[96px]")}>QTY</th>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[78px]" : "w-[112px]")}>PRICE</th>
                  <th className={cn("py-[1px] text-center", isA5 ? "w-[90px]" : "w-[128px]")}>TOTAL</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {tableItems.map((item, idx) => (
              <tr key={idx} className={cn(
                "border-b-[1.2px] border-black font-extrabold",
                isA5 ? "text-[7.5px] h-[14px] leading-[13px]" : "text-[11px] h-[20px] leading-[18px]"
              )}>
                <td className="text-center border-r-[1.5px] border-black py-[0px] whitespace-nowrap">{item.isEmpty ? '' : item.globalIndex + 1}</td>
                {isWood ? (
                  <>
                    <td className="text-center border-r-[1.5px] border-black py-[0px] whitespace-nowrap">{!item.isEmpty ? (item.treeNo?.startsWith('M-') ? 'M' : (item.carNo || '')) : ''}</td>
                    <td className={cn("text-center border-r-[1.5px] border-black py-[0px] whitespace-nowrap", isA5 ? "text-[6.5px]" : "text-[9.5px]")}>
                      {!item.isEmpty ? (
                        <>{`( ${item.treeNo || '-'} - ${item.width || 0}" - ${item.length || 0}' ) = ${item.cft?.toFixed(4)}`}</>
                      ) : ''}
                    </td>
                    <td className={cn("text-center border-r-[1.5px] border-black py-[0px] uppercase whitespace-nowrap", isA5 ? "text-[6px]" : "text-[8.5px]")}>{!item.isEmpty ? formatTagDisplay(item.tag) : ''}</td>
                    <td className="text-right pr-[8px] py-[0px] whitespace-nowrap">
                      {!item.isEmpty ? (showPaymentData ? Math.round(Number(item.total || 0)).toLocaleString() : '') : ''}
                    </td>
                  </>
                ) : (
                  <>
                    <td className={cn("pl-[4px] border-r-[1.5px] border-black text-left py-[0px] whitespace-nowrap overflow-hidden text-ellipsis", isA5 ? "max-w-[170px]" : "max-w-[250px]")}>
                      {!item.isEmpty ? <span className="uppercase">{item.name}</span> : ''}
                    </td>
                    <td className="text-center border-r-[1.5px] border-black py-[0px] uppercase whitespace-nowrap">
                      {!item.isEmpty ? `${item.quantity || 1} ${item.unit || 'PCS'}` : ''}
                    </td>
                    <td className="text-right pr-[4px] border-r-[1.5px] border-black py-[0px] whitespace-nowrap">
                      {!item.isEmpty ? (showPaymentData ? Math.round(Number(item.price || 0)).toLocaleString() : '') : ''}
                    </td>
                    <td className="text-right pr-[8px] py-[0px] whitespace-nowrap">
                      {!item.isEmpty ? (showPaymentData ? Math.round(Number(item.total || 0)).toLocaleString() : '') : ''}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    const DueSummaryHeader = ({label, value, isLast, labelClass, valueClass}: {label: string, value: string|number, isLast?: boolean, labelClass?: string, valueClass?: string}) => (
        <div className={cn(
          "flex justify-between items-center mt-[1px] border-black",
          isA5 ? "py-[1px]" : "py-0.5",
          isLast ? (isA5 ? "border-b-[3px]" : "border-b-4") : (isA5 ? "border-b-[1.5px]" : "border-b-[2px]")
        )}>
          <span className={cn("font-black uppercase", isA5 ? "text-[7.5px]" : "text-[10.5px]", labelClass)}>{label}</span>
          <span className={cn("font-extrabold", isA5 ? "text-[7.5px]" : "text-[10.5px]", valueClass)}>{value}</span>
        </div>
    )

    return (
      <div className={cn(
        "bg-white text-black font-sans mx-auto flex flex-col relative shadow-sm print:shadow-none print:m-0",
        isA5 
          ? "w-[148mm] h-[210mm] p-[7mm] print:p-[7mm]" 
          : "w-[210mm] h-[297mm] p-[10mm] print:p-[10mm]"
      )}>
        
        {/* Header Block */}
        <div className={cn("flex justify-between items-start print:break-inside-avoid", isA5 ? "mb-[8px]" : "mb-[12px]")}>
          <div className={isA5 ? "w-[126px]" : "w-[180px]"}>
             {business.logo ? (
                <div className={cn("flex flex-col items-center justify-center", isA5 ? "w-[45px] h-[45px] mb-[5px]" : "w-[64px] h-[64px] mb-[8px]")}>
                  <div className="relative w-full h-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={business.logo} 
                      alt="Logo" 
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: `${business.logoX ?? 50}% ${business.logoY ?? 50}%`,
                        transform: `translate(${((business.logoX ?? 50) - 50)}%, ${((business.logoY ?? 50) - 50)}%) scale(${(business.logoZoom ?? 100) / 100})`,
                        transformOrigin: 'center'
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
            ) : (
              <div className={cn("border-[1.5px] border-black flex items-center justify-center text-center", isA5 ? "w-[45px] h-[45px] mb-[5px]" : "w-[64px] h-[64px] mb-[8px]")}>
                 <span className={cn("font-black text-black flex items-center justify-center h-full w-full", isA5 ? "text-[7px]" : "text-[10px]")}>LOGO</span>
              </div>
            )}
            <div className={isA5 ? "mt-[16px]" : "mt-[24px]"}>
              <h2 className={cn("font-black uppercase tracking-wide text-black drop-shadow-sm", isA5 ? "text-[9px] mb-[2px]" : "text-[13px] mb-[4px]")}>INVOICE TO :-</h2>
              <div className={cn("flex flex-col leading-tight text-black font-black", isA5 ? "gap-[2px] text-[7.5px]" : "gap-[4px] text-[10.5px]")}>
                <p className="lowercase">{invoice.customer}</p>
                {invoice.customerAddress && <p>{invoice.customerAddress}</p>}
                {invoice.customerPhone && <p>{invoice.customerPhone}</p>}
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center text-center">
             <h1 className={cn("font-black text-black tracking-tight whitespace-nowrap", isA5 ? "text-[21px] mb-[1px]" : "text-[30px] mb-[2px]")}>{business.name}</h1>
             {business.address && <p className={cn("font-black text-black", isA5 ? "text-[8px]" : "text-[11px]")}>{business.address}</p>}
             {business.email && <p className={cn("font-extrabold text-black", isA5 ? "text-[8px]" : "text-[11px]")}>Email: {business.email}</p>}
             {business.phone && <p className={cn("font-extrabold text-black", isA5 ? "text-[8px]" : "text-[11px]")}>Mobile: {business.phone}{business.secondaryPhone ? `, ${business.secondaryPhone}` : ''}</p>}
             
             <h1 className={cn("font-black tracking-[2px] uppercase text-black", isA5 ? "text-[22px] mt-[8px]" : "text-[32px] mt-[12px]")}>
                {isChalan ? 'CHALAN' : 'INVOICE'}
             </h1>
          </div>

          <div className={cn("flex flex-col items-stretch", isA5 ? "mt-[20px] mb-0 w-[126px] space-y-[3px]" : "mt-[40px] mb-0 w-[180px] space-y-[4px]")}>
            <div className={cn("flex justify-center", isA5 ? "mt-[-20px] mb-[20px] w-[40px] h-[40px] ml-[81px]" : "mt-[-40px] mb-[30px] w-[60px] h-[60px] ml-[115px]")}>
              <QRCode 
                value={getDisplayInvoiceId(invoice.id)} 
                size={isA5 ? 40 : 55}
                style={{ height: "auto", maxWidth: "100%", width: isA5 ? "40px" : "55px" }}
                viewBox={`0 0 256 256`}
              />
            </div>
            <div className={cn("border-[1.5px] border-black bg-black text-white rounded-lg flex items-center justify-center text-center", isA5 ? "px-[5px] py-[1.5px]" : "px-[8px] py-[2px]")}>
               <span className={cn("font-extrabold", isA5 ? "text-[6.5px]" : "text-[9px]")}>{isChalan ? 'Chalan No' : 'Invoice No'}: {getDisplayInvoiceId(invoice.id)}</span>
            </div>
            <div className={cn("border-[1.5px] border-black bg-black text-white rounded-lg flex items-center justify-center text-center", isA5 ? "px-[5px] py-[1.5px]" : "px-[8px] py-[2px]")}>
               <span className={cn("font-extrabold", isA5 ? "text-[6.5px]" : "text-[9px]")}>{isChalan ? 'Chalan Date' : 'Invoice Date'}: {formatDate(isChalan ? new Date().toISOString() : invoice.date)}</span>
            </div>
            {(invoice.deliveryDate || invoice.delivery_date) && !isWood && (
              <div className={cn("border-[1.5px] border-black bg-black text-white rounded-lg flex items-center justify-center text-center", isA5 ? "px-[5px] py-[1.5px]" : "px-[8px] py-[2px]")}>
                 <span className={cn("font-extrabold", isA5 ? "text-[6.5px]" : "text-[9px]")}>Delivery Date: {formatDate(invoice.deliveryDate || invoice.delivery_date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Table Section */}
        {isWood ? (
          <div className={cn("flex flex-1 min-h-0 print:break-inside-avoid", isA5 ? "gap-[4px]" : "gap-[6px]")}>
            <div className="flex-1 flex flex-col h-full rounded-sm">
              {renderTable(leftTableItems)}
              <div className={cn("block w-[48%] self-center", isA5 ? "mt-[8px] pb-[2px]" : "mt-[12px] pb-[4px]")}>
                <DueSummaryHeader label="PREV DUE:" value={showPaymentData ? Math.round(invoice.oldDue || 0).toLocaleString() : ''} />
                <DueSummaryHeader label="CURR DUE:" value={showPaymentData ? Math.round(invoice.due || 0).toLocaleString() : ''} isLast={true} />
                <DueSummaryHeader label="TOTAL DUE:" value={showPaymentData ? Math.round((invoice.oldDue || 0) + (invoice.due || 0)).toLocaleString() : ''} />
              </div>
            </div>
            
            <div className="flex-1 flex flex-col h-full rounded-sm">
              {renderTable(rightTableItems)}
              <div className={cn("block w-full self-end", isA5 ? "mt-[8px]" : "mt-[12px]")}>
                  <DueSummaryHeader label="TOTAL CFT:" value={invoice.items.reduce((sum:any, item:any)=> sum + (item.cft || 0), 0).toFixed(4)} />
                  <DueSummaryHeader label="Subtotal:" value={showPaymentData ? Math.round(itemsSubtotal || 0).toLocaleString() : ''} />
                  {invoice.discount > 0 && (
                    <DueSummaryHeader label={`Discount ${invoice.discountType === 'percent' ? `(${invoice.discount}%)` : ''}:`} value={showPaymentData ? `-${Math.round(discountAmount || 0).toLocaleString()}` : ''} />
                  )}
                  {invoice.deliveryCharge > 0 && (
                    <DueSummaryHeader label="Delivery Charge:" value={showPaymentData ? Math.round(invoice.deliveryCharge || 0).toLocaleString() : ''} />
                  )}
                  <DueSummaryHeader label="TOTAL:" value={showPaymentData ? Math.round(totalOrderAmount || 0).toLocaleString() : ''} />
                  {invoice.payments && invoice.payments.length > 0 ? (
                    invoice.payments.map((p: any, i: number) => (
                      <DueSummaryHeader key={i} label={`Payment On ${formatDate(p.date)} (${capitalizeMethod(p.method)}) :`} value={showPaymentData ? Math.round(p.amount || 0).toLocaleString() : ''} labelClass={cn("normal-case text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} valueClass={cn("text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} />
                    ))
                  ) : (invoice.paid || 0) > 0 ? (
                      <DueSummaryHeader label={`Payment On ${formatDate(invoice.date)} (${capitalizeMethod(invoice.paymentMethod)}) :`} value={showPaymentData ? Math.round(invoice.paid || 0).toLocaleString() : ''} labelClass={cn("normal-case text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} valueClass={cn("text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} />
                  ) : null}
                  <DueSummaryHeader label="AMOUNT DUE:" value={showPaymentData ? Math.round(invoice.due || 0).toLocaleString() : ''} isLast={invoice.due === 0} labelClass="text-rose-700" valueClass="text-rose-700" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 print:break-inside-avoid">
            {renderTable([
              ...items.map((item: any, idx: number) => ({ ...item, globalIndex: idx }))
            ])}
            <div className={cn("flex justify-between w-full print:break-inside-avoid", isA5 ? "mt-[10px] gap-[20px]" : "mt-[16px] gap-[32px]")}>
              {/* Left Side: PREV DUE, CURR DUE, TOTAL DUE */}
              <div className="flex-1 flex flex-col items-center pt-[2px]">
                <div className={cn("w-[50%]", isA5 ? "pb-[2px]" : "pb-[4px]")}>
                  <DueSummaryHeader label="PREV DUE:" value={showPaymentData ? Math.round(invoice.oldDue || 0).toLocaleString() : ''} />
                  <DueSummaryHeader label="CURR DUE:" value={showPaymentData ? Math.round(invoice.due || 0).toLocaleString() : ''} isLast={true} />
                  <DueSummaryHeader label="TOTAL DUE:" value={showPaymentData ? Math.round((invoice.oldDue || 0) + (invoice.due || 0)).toLocaleString() : ''} />
                </div>
              </div>

              {/* Right Side: Totals and Payments */}
              <div className="flex-1 flex flex-col">
                <DueSummaryHeader label="Subtotal:" value={showPaymentData ? Math.round(itemsSubtotal || 0).toLocaleString() : ''} />
                {invoice.discount > 0 && (
                  <DueSummaryHeader label={`Discount ${invoice.discountType === 'percent' ? `(${invoice.discount}%)` : ''}:`} value={showPaymentData ? `-${Math.round(discountAmount || 0).toLocaleString()}` : ''} />
                )}
                {invoice.deliveryCharge > 0 && (
                  <DueSummaryHeader label="Delivery Charge:" value={showPaymentData ? Math.round(invoice.deliveryCharge || 0).toLocaleString() : ''} />
                )}
                <DueSummaryHeader label="TOTAL:" value={showPaymentData ? Math.round(totalOrderAmount || 0).toLocaleString() : ''} />
                
                {invoice.payments && invoice.payments.length > 0 ? (
                  invoice.payments.map((p: any, i: number) => (
                    <DueSummaryHeader key={i} label={`Payment On ${formatDate(p.date)} (${capitalizeMethod(p.method)}) :`} value={showPaymentData ? Math.round(p.amount || 0).toLocaleString() : ''} labelClass={cn("normal-case text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} valueClass={cn("text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} />
                  ))
                ) : (invoice.paid || 0) > 0 ? (
                    <DueSummaryHeader label={`Payment On ${formatDate(invoice.date)} (${capitalizeMethod(invoice.paymentMethod)}) :`} value={showPaymentData ? Math.round(invoice.paid || 0).toLocaleString() : ''} labelClass={cn("normal-case text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} valueClass={cn("text-emerald-700 font-extrabold", isA5 ? "text-[7px]" : "text-[10px]")} />
                ) : null}
                <DueSummaryHeader label="AMOUNT DUE:" value={showPaymentData ? Math.round(invoice.due || 0).toLocaleString() : ''} isLast={invoice.due === 0} labelClass="text-rose-700" valueClass="text-rose-700" />
              </div>
            </div>
          </div>
        )}
        
        {/* Signatures */}
        <div className={cn(
          "mt-auto flex justify-between items-end print:break-inside-avoid",
          isA5 ? "px-[32px] pb-[2px] pt-[8px]" : "px-[48px] pb-[4px] pt-[12px]"
        )}>
           <div className={cn("text-center", isA5 ? "w-[135px]" : "w-[192px]")}>
              <div className={cn("border-black shrink-0", isA5 ? "border-t-[1.5px] mb-[2px]" : "border-t-[2px] mb-[4px]")}></div>
              <p className={cn("font-black tracking-wide", isA5 ? "text-[6.5px]" : "text-[9px]")}>CUSTOMER SIGNATURE</p>
           </div>
           
           <div className={cn("text-center", isA5 ? "w-[135px]" : "w-[192px]")}>
              <div className={cn("border-black shrink-0", isA5 ? "border-t-[1.5px] mb-[2px]" : "border-t-[2px] mb-[4px]")}></div>
              <p className={cn("font-black tracking-wide", isA5 ? "text-[6.5px]" : "text-[9px]")}>AUTHORIZED SIGNATURE</p>
           </div>
        </div>
        
        <div className={cn("text-center font-black tracking-wide print:break-inside-avoid", isA5 ? "mt-[2px] text-[7px] pb-[2px]" : "mt-[4px] text-[10px] pb-[4px]")}>
           Just wanted to say thank you for your purchase. We&apos;re so lucky to have customers like you!
        </div>

      </div>
    )
  }

  return (
    <div className={cn(
      "bg-white text-black font-sans mx-auto flex flex-col shadow-sm print:shadow-none relative print:overflow-visible",
      isA5 && "w-[148mm] min-h-[210mm] h-auto p-[15mm]"
    )}>
      <div className="flex justify-between items-start mb-[32px] print:break-inside-avoid">
        <div className="space-y-[16px]">
          <div className="flex flex-col">
            {business.logo ? (
                <div className="relative w-[256px] h-[128px] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={business.logo} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${business.logoX ?? 50}% ${business.logoY ?? 50}%`,
                      transform: `translate(${((business.logoX ?? 50) - 50)}%, ${((business.logoY ?? 50) - 50)}%) scale(${(business.logoZoom ?? 100) / 100})`,
                      transformOrigin: 'center'
                    }}
                    referrerPolicy="no-referrer"
                  />
                </div>
            ) : (
              <span className="text-[24px] font-black text-black tracking-tight uppercase">YOUR LOGO</span>
            )}
          </div>
          <div className="pt-[16px] space-y-[4px]">
            <p className="text-[14px] font-bold text-black">{isChalan ? 'Chalan' : 'Invoice'} Number: {getDisplayInvoiceId(invoice.id)}</p>
            {(invoice.deliveryDate || invoice.delivery_date) && !isWood && (
              <p className="text-[14px] font-bold text-black">Delivery Date: {formatDate(invoice.deliveryDate || invoice.delivery_date)}</p>
            )}
          </div>
        </div>
        <div className="text-right space-y-[8px]">
          <h1 className="text-[36px] font-black text-black tracking-tight uppercase mb-[8px]">{isChalan ? 'CHALAN' : 'INVOICE'}</h1>
          <div className="bg-black text-white px-[12px] py-[6px] rounded-sm inline-block w-fit text-center">
             <span className="text-[14px] font-bold">{isChalan ? 'Chalan' : 'Invoice'} Date: {formatDate(isChalan ? new Date().toISOString() : invoice.date)}</span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="grid grid-cols-2 gap-[32px] mb-[32px] print:break-inside-avoid">
        <div className="space-y-[4px]">
          <h3 className="text-[14px] font-bold text-black mb-[8px]">{isChalan ? 'Ship To' : 'Invoice To'}:</h3>
          <p className="text-[14px] font-black text-black">{invoice.customer}</p>
          <p className="text-[14px] text-black">{invoice.customerAddress}</p>
          <p className="text-[14px] text-black font-bold">{invoice.customerPhone}</p>
          {(invoice.deliveryDate || invoice.delivery_date) && !isWood && (
            <p className="text-[14px] text-black font-bold">Delivery Date: {formatDate(invoice.deliveryDate || invoice.delivery_date)}</p>
          )}
        </div>
        <div className="text-right space-y-[2px]">
          {business.name && <p className="text-[24px] font-black text-black">{business.name}</p>}
          {business.address && <p className="text-[14px] text-black">{business.address}</p>}
          {business.email && <p className="text-[14px] text-black">Email: {business.email}</p>}
          {business.phone && <p className="text-[14px] font-bold text-black">Mobile: {business.phone}{business.secondaryPhone ? `, ${business.secondaryPhone}` : ''}</p>}
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1">
        <table className="w-full border-collapse border-[1.5px] border-black text-black">
          <thead>
            <tr className="border-y-[1.5px] border-black text-[12px] uppercase font-bold text-black border-collapse">
              <th className="px-[16px] py-[10px] text-center border-r-[1.5px] border-black w-[48px]">NO</th>
              {isWood ? (
                <>
                  <th className="px-[8px] py-[10px] text-left border-r-[1.5px] border-black w-[64px] uppercase">CAR</th>
                  <th className="px-[16px] py-[10px] text-left border-r-[1.5px] border-black uppercase">( TREE - W - L ) = SIZE</th>
                  <th className="px-[12px] py-[10px] text-center border-r-[1.5px] border-black w-[80px] uppercase">TAG</th>
                  <th className="px-[16px] py-[10px] text-right uppercase">TOTAL</th>
                </>
              ) : (
                <>
                  <th className="px-[16px] py-[10px] text-left border-r-[1.5px] border-black">ITEM</th>
                  <th className="px-[16px] py-[10px] text-center border-r-[1.5px] border-black w-[96px]">QTY</th>
                  <th className="px-[16px] py-[10px] text-right border-r-[1.5px] border-black uppercase w-[112px]">PRICE</th>
                  <th className="px-[16px] py-[10px] text-right uppercase w-[128px]">TOTAL</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={`item-${idx}`} className="text-[14px] border-x border-slate-200 break-inside-avoid text-black font-medium">
                <td className="px-[16px] py-[8px] text-center border border-slate-200 font-bold">{idx + 1}</td>
                {isWood ? (
                  <>
                    <td className="px-[8px] py-[8px] border border-slate-200 text-[12px] font-bold uppercase">{item.treeNo?.startsWith('M-') ? 'M' : (item.carNo || '-')}</td>
                    <td className="px-[16px] py-[8px] border border-slate-200">
                      <span className="text-black font-medium tracking-tight">( {item.treeNo || '-'} - {item.width || 0}&quot; - {item.length || 0}&apos; ) = </span>
                      <span className="font-bold text-black">{item.cft?.toFixed(4)}</span>
                    </td>
                    <td className="px-[12px] py-[8px] border border-slate-200 text-center text-[12px] font-bold uppercase">
                      {item.tag || '-'}
                    </td>
                    <td className="px-[16px] py-[8px] text-right border border-slate-200 font-bold">
                      {Number(item.total || 0).toLocaleString()}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-[16px] py-[8px] border border-slate-200">
                      <p className="font-bold uppercase">{item.name}</p>
                      {item.description && <p className="text-[12px] text-black">{item.description}</p>}
                    </td>
                    <td className="px-[16px] py-[8px] text-center border border-slate-200 font-bold uppercase">
                      {item.quantity || 1} {item.unit || 'PCS'}
                    </td>
                    <td className="px-[16px] py-[8px] text-right border border-slate-200 font-bold">
                      {Number(item.price || 0).toLocaleString()}
                    </td>
                    <td className="px-[16px] py-[8px] text-right border border-slate-200 font-bold">
                      {Number(item.total || 0).toLocaleString()}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="mt-[24px] flex flex-col items-end space-y-[4px] print:break-inside-avoid text-black">
          <div className="flex justify-between w-[350px] text-[13px]">
            <span className="font-bold">Subtotal:</span>
            <span className="font-bold">{showPaymentData ? `${Math.round(itemsSubtotal || 0).toLocaleString()} BDT` : ''}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between w-[350px] text-[13px]">
              <span className="font-bold">Discount {invoice.discountType === 'percent' ? `(${invoice.discount}%)` : ''}:</span>
              <span className="font-bold">{showPaymentData ? `-${Math.round(discountAmount || 0).toLocaleString()} BDT` : ''}</span>
            </div>
          )}
          {invoice.deliveryCharge > 0 && (
            <div className="flex justify-between w-[350px] text-[13px]">
              <span className="font-bold">Delivery Charge:</span>
              <span className="font-bold">{showPaymentData ? `${Math.round(invoice.deliveryCharge || 0).toLocaleString()} BDT` : ''}</span>
            </div>
          )}
          <div className="flex justify-between w-[350px] text-[13px] border-t border-black pt-[4px]">
            <span className="font-bold uppercase tracking-tight text-[14px]">Total:</span>
            <span className="font-bold text-[14px]">{showPaymentData ? `${Math.round(totalOrderAmount || 0).toLocaleString()} BDT` : ''}</span>
          </div>
          
          {invoice.payments && invoice.payments.length > 0 ? (
            invoice.payments.map((p: any, i: number) => (
              <div key={`payment-${i}`} className="flex justify-between w-[350px] text-[13px] text-emerald-700 print:text-emerald-700 font-bold border-t border-black pt-[4px]">
                <span className="text-black flex-1 text-left">Payment On {formatDate(p.date)} ({capitalizeMethod(p.method)}) :</span>
                <span className="shrink-0 text-right">{showPaymentData ? `${Math.round(p.amount || 0).toLocaleString()} BDT` : ''}</span>
              </div>
            ))
          ) : (invoice.paid || 0) > 0 && (
            <div className="flex justify-between w-[350px] text-[12px] text-emerald-700 print:text-emerald-700 font-bold border-t border-black pt-[4px]">
              <span className="text-black flex-1 text-left">Payment On {formatDate(invoice.date)} ({capitalizeMethod(invoice.paymentMethod)}) :</span>
              <span className="shrink-0 text-right">{showPaymentData ? `${Math.round(invoice.paid || 0).toLocaleString()} BDT` : ''}</span>
            </div>
          )}
          
          <div className="flex justify-between w-[350px] text-[13px] pt-[4px] border-t border-black">
            <span className="font-black text-rose-700 print:text-rose-700 uppercase">AMOUNT DUE:</span>
            <span className="font-black text-rose-700 print:text-rose-700">
              {showPaymentData ? `${Math.round(invoice.due || 0).toLocaleString()} BDT` : ''}
            </span>
          </div>
        </div>

        {/* Due Summary Table */}
        <div className="mt-[24px] w-[190px] text-[12px]">
          <div className="flex justify-between py-[4px] border-b border-slate-200">
            <span className="text-black uppercase font-medium">Prev Due:</span>
            <span className="font-bold text-black">{showPaymentData ? Math.round(invoice.oldDue || 0).toLocaleString() : ''}</span>
          </div>
          <div className="flex justify-between py-[4px] border-b border-slate-200">
            <span className="text-black uppercase font-medium">Curr Due:</span>
            <span className="font-bold text-black">{showPaymentData ? Math.round(invoice.due || 0).toLocaleString() : ''}</span>
          </div>
          <div className="flex justify-between py-[4px] border-t border-black">
            <span className="text-black uppercase font-bold">Total Due:</span>
            <span className="font-bold text-black">{showPaymentData ? Math.round((invoice.oldDue || 0) + (invoice.due || 0)).toLocaleString() : ''}</span>
          </div>
        </div>
      </div>

        {/* Footer Section */}
      <div className="mt-auto print:break-inside-avoid border-t border-slate-100 pt-[32px]">
        <div className="flex justify-between items-end mb-[96px]">
          <div className="text-center">
            <div className="w-[256px] border-b border-black mb-[8px]"></div>
            <p className="text-[12px] font-bold text-black uppercase">Customer Signature</p>
          </div>
          <div className="text-center">
            <div className="w-[256px] border-b border-black mb-[8px]"></div>
            <p className="text-[12px] font-bold text-black uppercase">Authorized Signature</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-[11px] font-bold text-black">
            Just wanted to say thank you for your purchase. We&apos;re so lucky to have customers like you!
          </p>
        </div>
      </div>
    </div>
  )
}

