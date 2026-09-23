'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Plus, UserCog, Phone, Calendar, MoreVertical, Shield, Briefcase, Eye, Edit2, Trash2, X, ChevronDown, Check, DollarSign, Wallet, Users, Settings } from 'lucide-react'
import { cn, safeParse, parseDateSafe } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { addNotification } from '@/lib/notifications'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { motion, AnimatePresence } from 'motion/react'

interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  joinDate: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Inactive';
  createdAt: string;
}

const initialStaff: StaffMember[] = [
  { id: 'STF-001', name: 'Rahim Ahmed', role: 'Carpenter', phone: '+880 1711-111111', joinDate: '2023-01-15', salary: 25000, status: 'Active', createdAt: new Date().toISOString() },
  { id: 'STF-002', name: 'Karim Ullah', role: 'Salesman', phone: '+880 1711-222222', joinDate: '2023-05-10', salary: 18000, status: 'Active', createdAt: new Date().toISOString() },
  { id: 'STF-003', name: 'Selim Reza', role: 'Manager', phone: '+880 1711-333333', joinDate: '2022-11-01', salary: 45000, status: 'Active', createdAt: new Date().toISOString() },
  { id: 'STF-004', name: 'Abul Kashem', role: 'Delivery Staff', phone: '+880 1711-444444', joinDate: '2023-08-20', salary: 15000, status: 'Active', createdAt: new Date().toISOString() },
]

const defaultRoles = ['Manager', 'Carpenter', 'Salesman', 'Delivery Staff', 'Accountant', 'Security']

function StaffPageContent() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [roles, setRoles] = useState<string[]>(defaultRoles)
  const [isLoading, setIsLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null)

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [editingRole, setEditingRole] = useState<{ original: string, current: string } | null>(null)

  const availableRoles = useMemo(() => {
    return [...roles].sort();
  }, [roles]);

  const [newStaff, setNewStaff] = useState<Omit<StaffMember, 'id' | 'createdAt'>>({
    name: '',
    role: 'Carpenter',
    phone: '',
    joinDate: new Date().toISOString().split('T')[0],
    salary: 0,
    status: 'Active'
  })

  useEffect(() => {
    fetchStaff()
    fetchRoles()
  }, [])

  const fetchStaff = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('join_date', { ascending: false })

      if (error) throw error
      
      if (data) {
        const mappedStaff = data.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          phone: s.phone,
          joinDate: s.join_date,
          salary: Number(s.salary),
          status: s.status,
          createdAt: s.created_at
        }))
        setStaff(mappedStaff)
      }
    } catch (error: any) {
      console.error('Error fetching staff:', error)
      toast.error('Failed to load staff members')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('settings')
        .eq('id', 'business_roles')
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.settings) {
        setRoles(data.settings as string[]);
      } else {
        // Initialize default roles if not found
        await supabase
          .from('app_settings')
          .upsert({ id: 'business_roles', settings: defaultRoles });
        setRoles(defaultRoles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }

  const handleAddRole = async () => {
    if (!newRoleName || roles.includes(newRoleName)) return;
    const updatedRoles = [...roles, newRoleName];
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 'business_roles', settings: updatedRoles });
      
      if (error) throw error;
      setRoles(updatedRoles);
      setNewRoleName('');
      toast.success('Role added');
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to add role');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingRole || !editingRole.current || (editingRole.original !== editingRole.current && roles.includes(editingRole.current))) {
      setEditingRole(null);
      return;
    }
    
    const updatedRoles = roles.map(r => r === editingRole.original ? editingRole.current : r);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 'business_roles', settings: updatedRoles });
      
      if (error) throw error;
      setRoles(updatedRoles);
      toast.success('Role updated');
      setEditingRole(null);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleToDelete: string) => {
    const updatedRoles = roles.filter(r => r !== roleToDelete);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 'business_roles', settings: updatedRoles });
      
      if (error) throw error;
      setRoles(updatedRoles);
      toast.success('Role deleted');
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Failed to delete role');
    }
  };

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    }).sort((a, b) => parseDateSafe(b.joinDate).getTime() - parseDateSafe(a.joinDate).getTime());
  }, [staff, searchTerm]);

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter(s => s.status === 'Active').length;
    const onLeave = staff.filter(s => s.status === 'On Leave').length;
    const totalPayroll = staff.reduce((acc, s) => acc + s.salary, 0);

    return { total, active, onLeave, totalPayroll };
  }, [staff]);

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.phone || newStaff.salary <= 0 || !newStaff.role) return;
    
    try {
      const id = `STF-${Math.floor(100 + Math.random() * 900)}`;
      const { error } = await supabase.from('staff').insert([{
        id,
        name: newStaff.name,
        role: newStaff.role,
        phone: newStaff.phone,
        join_date: newStaff.joinDate,
        salary: newStaff.salary,
        status: newStaff.status
      }])

      if (error) throw error

      addNotification('settings_update', 'Staff Added', `New staff member ${newStaff.name} registered.`);
      toast.success('Staff member registered')
      fetchStaff()
      setIsAddModalOpen(false);
      setNewStaff({
        name: '',
        role: roles[0] || 'Carpenter',
        phone: '',
        joinDate: new Date().toISOString().split('T')[0],
        salary: 0,
        status: 'Active'
      });
    } catch (error: any) {
      console.error('Error adding staff:', error)
      toast.error(error.message || 'Failed to register staff member')
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    try {
      const { error } = await supabase.from('staff').update({
        name: editingStaff.name,
        role: editingStaff.role,
        phone: editingStaff.phone,
        join_date: editingStaff.joinDate,
        salary: editingStaff.salary,
        status: editingStaff.status
      }).eq('id', editingStaff.id)

      if (error) throw error

      addNotification('settings_update', 'Staff Updated', `Staff member ${editingStaff.name} details updated.`);
      toast.success('Staff details updated')
      fetchStaff()
      setIsEditModalOpen(false);
      setEditingStaff(null);
    } catch (error: any) {
      console.error('Error updating staff:', error)
      toast.error(error.message || 'Failed to update staff member')
    }
  };

  const handleDeleteStaff = (id: string) => {
    setStaffToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (staffToDelete) {
      try {
        const { error } = await supabase.from('staff').delete().eq('id', staffToDelete)
        if (error) throw error
        
        toast.success('Staff member removed')
        fetchStaff()
        setIsDeleteModalOpen(false);
        setStaffToDelete(null);
      } catch (error: any) {
        console.error('Error deleting staff:', error)
        toast.error('Failed to terminate staff member')
      }
    }
  };
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 italic">Staff</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsRoleModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              title="Manage Roles"
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
            >
              <Plus size={18} /> Add Staff Member
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Staff', value: stats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
            { label: 'Active', value: stats.active, icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'On Leave', value: stats.onLeave, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            { label: 'Monthly Payroll', value: `৳${(stats.totalPayroll / 1000).toFixed(1)}k`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
          ].map((stat) => (
            <div key={stat.label} className={cn("p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm", stat.bg)}>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <div className="flex items-center justify-between">
                <h3 className={cn("text-lg sm:text-xl font-display font-bold", stat.color)}>{stat.value}</h3>
                <stat.icon size={16} className={stat.color} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, role or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
              />
            </div>
          </div>

          {/* Table View (Desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Contact & Join Date</th>
                  <th className="px-6 py-4">Monthly Salary</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold group-hover:scale-110 transition-transform">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">{s.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5"><Briefcase size={14} className="text-indigo-500" /> {s.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300"><Phone size={13} className="text-slate-400" /> {s.phone}</span>
                        <span className="flex items-center gap-2"><Calendar size={13} className="text-slate-400" /> Since {s.joinDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">৳{s.salary.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                        s.status === 'Active' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : 
                        s.status === 'On Leave' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                        "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
                      )}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all outline-none">
                            <MoreVertical size={20} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl">
                          <DropdownMenuItem onClick={() => handleEditStaff(s)} className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">
                            <Edit2 size={16} className="text-indigo-500" /> Edit Member
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">
                            <Eye size={16} className="text-indigo-500" /> Full Profile
                          </DropdownMenuItem>
                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
                          <DropdownMenuItem onClick={() => handleDeleteStaff(s.id)} className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 transition-all cursor-pointer">
                            <Trash2 size={16} /> Terminate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards View (Mobile) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStaff.map((s) => (
              <div key={s.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-lg">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{s.name}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase">{s.id}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 -mr-2 text-slate-400">
                        <MoreVertical size={20} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleEditStaff(s)}>Edit Member</DropdownMenuItem>
                      <DropdownMenuItem>View Profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteStaff(s.id)} className="text-rose-600">Terminate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Role</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Briefcase size={12} className="text-indigo-500" /> {s.role}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                      s.status === 'Active' ? "bg-emerald-100 text-emerald-700" : 
                      s.status === 'On Leave' ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                    )}>{s.status}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Phone size={12} className="text-slate-400" /> {s.phone}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2"><Calendar size={12} className="text-slate-400" /> Since {s.joinDate}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-display font-black text-indigo-600 dark:text-indigo-400">৳{s.salary.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredStaff.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-slate-500 dark:text-slate-400 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <Search size={32} className="text-slate-300" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">No staff members found</p>
                <p className="text-sm max-w-xs mx-auto">Try adjusting your search terms.</p>
              </div>
              <button 
                onClick={() => { setSearchTerm(''); }}
                className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Modals */}
        <AnimatePresence>
          {isRoleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsRoleModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Settings size={20} />
                    </div>
                    Manage Roles
                  </h2>
                  <button 
                    onClick={() => setIsRoleModalOpen(false)}
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Add New Role</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="e.g. Designer"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                      />
                      <button 
                        onClick={handleAddRole}
                        disabled={!newRoleName}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Existing Roles</label>
                    <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                      {roles.map((role) => (
                        <div key={role} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl group/role">
                          {editingRole?.original === role ? (
                            <div className="flex-1 flex gap-2">
                              <input 
                                type="text"
                                autoFocus
                                value={editingRole.current}
                                onChange={(e) => setEditingRole({ ...editingRole, current: e.target.value })}
                                className="flex-1 px-3 py-1 bg-white dark:bg-slate-900 border border-indigo-500 rounded-lg text-sm outline-none"
                              />
                              <button onClick={handleUpdateRole} className="p-1 px-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">SAVE</button>
                              <button onClick={() => setEditingRole(null)} className="p-1 px-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold">CANCEL</button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <Briefcase size={16} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{role}</span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover/role:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setEditingRole({ original: role, current: role })}
                                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-600"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteRole(role)}
                                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {(isAddModalOpen || isEditModalOpen) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <UserCog size={20} />
                    </div>
                    {isAddModalOpen ? 'Add Staff Member' : 'Edit Staff Details'}
                  </h2>
                  <button 
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5 custom-scrollbar font-medium">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Rahim Ahmed"
                        value={isAddModalOpen ? newStaff.name : editingStaff?.name || ''}
                        onChange={(e) => isAddModalOpen 
                          ? setNewStaff({ ...newStaff, name: e.target.value })
                          : setEditingStaff({ ...editingStaff!, name: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text"
                          placeholder="+880 1711-XXXXXX"
                          value={isAddModalOpen ? newStaff.phone : editingStaff?.phone || ''}
                          onChange={(e) => isAddModalOpen 
                            ? setNewStaff({ ...newStaff, phone: e.target.value })
                            : setEditingStaff({ ...editingStaff!, phone: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Role</label>
                        <button 
                          type="button"
                          onClick={() => {
                            // Close current modal then open roles modal
                            setIsAddModalOpen(false);
                            setIsEditModalOpen(false);
                            setIsRoleModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Manage Role Library"
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <select 
                          value={isAddModalOpen ? newStaff.role : editingStaff?.role || 'Carpenter'}
                          onChange={(e) => {
                            if (isAddModalOpen) {
                              setNewStaff({ ...newStaff, role: e.target.value });
                            } else if (editingStaff) {
                              setEditingStaff({ ...editingStaff, role: e.target.value });
                            }
                          }}
                          className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                        >
                          {availableRoles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Monthly Salary (৳)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={isAddModalOpen ? newStaff.salary : editingStaff?.salary || 0}
                          onChange={(e) => isAddModalOpen 
                            ? setNewStaff({ ...newStaff, salary: parseFloat(e.target.value) || 0 })
                            : setEditingStaff({ ...editingStaff!, salary: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Joining Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date"
                          value={isAddModalOpen ? newStaff.joinDate : editingStaff?.joinDate || ''}
                          onChange={(e) => isAddModalOpen 
                            ? setNewStaff({ ...newStaff, joinDate: e.target.value })
                            : setEditingStaff({ ...editingStaff!, joinDate: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Employment Status</label>
                      <div className="flex gap-2">
                        {(['Active', 'On Leave', 'Inactive'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => isAddModalOpen
                              ? setNewStaff({ ...newStaff, status: s })
                              : setEditingStaff({ ...editingStaff!, status: s })
                            }
                            className={cn(
                              "flex-1 py-3 px-3 rounded-xl text-[10px] font-bold transition-all border",
                              (isAddModalOpen ? newStaff.status === s : editingStaff?.status === s)
                                ? s === 'Active' ? "bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-900/30" : 
                                  s === 'On Leave' ? "bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/30" :
                                  "bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-900/30"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                  <button 
                    onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
                    className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-95"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={isAddModalOpen ? handleAddStaff : handleUpdateStaff}
                    className="flex-1 px-6 py-3 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                    disabled={isAddModalOpen ? (!newStaff.name || !newStaff.phone || !newStaff.salary) : (!editingStaff?.name || !editingStaff?.phone || !editingStaff?.salary)}
                  >
                    {isAddModalOpen ? 'Register Member' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center"
              >
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
                  !
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">Terminate Employment</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Are you sure you want to terminate this staff member? This action will remove them from the active list.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-3 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all rounded-xl active:scale-95"
                  >
                    Terminate
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}

export default function StaffPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>}>
      <StaffPageContent />
    </Suspense>
  )
}
