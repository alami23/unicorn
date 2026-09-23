'use client'

import React, { useState, Suspense } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Printer, Download, Calendar, User, History, Wallet, Award, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const salaryHistory = [
  { id: 'SAL-001', month: 'March 2024', amount: 25000, date: '2024-03-01', status: 'Paid', method: 'Bank Transfer' },
  { id: 'SAL-002', month: 'February 2024', amount: 25000, date: '2024-02-01', status: 'Paid', method: 'Cash' },
  { id: 'SAL-003', month: 'January 2024', amount: 25000, date: '2024-01-01', status: 'Paid', method: 'Bank Transfer' },
]

function StaffStatementContent() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Staff Statement</h1>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Printer size={18} /> Print
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Download size={18} /> Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-8 items-center">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-600/20">
              RA
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Rahim Ahmed</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Staff ID: STF-001 • Carpenter • Workshop</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">Joined: Jan 15, 2023</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Monthly Salary</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">৳25,000</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">৳350,000</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Advance</p>
              <p className="text-lg font-bold text-rose-500 dark:text-rose-400">৳2,000</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Attendance</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">98%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><Wallet size={18} /> Salary History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Month</th>
                      <th className="px-6 py-4 font-semibold">Amount</th>
                      <th className="px-6 py-4 font-semibold">Date Paid</th>
                      <th className="px-6 py-4 font-semibold">Method</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salaryHistory.map((sal) => (
                      <tr key={sal.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">{sal.month}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100">৳{sal.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{sal.date}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{sal.method}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">{sal.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Award size={18} /> Incentives & Bonus</h3>
              <div className="space-y-4">
                {[
                  { title: 'Best Carpenter of Month', date: 'Feb 2024', amount: '৳2,000' },
                  { title: 'Overtime Bonus', date: 'Jan 2024', amount: '৳1,500' },
                ].map((item) => (
                  <div key={item.title} className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div>
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{item.title}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">{item.date}</p>
                    </div>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">{item.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Clock size={18} /> Work Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Completed Projects</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">12</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Pending Tasks</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">3</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Avg. Daily Hours</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">8.5h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function StaffStatementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <StaffStatementContent />
    </Suspense>
  )
}
