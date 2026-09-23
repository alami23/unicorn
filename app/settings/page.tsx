"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import DashboardLayout from "@/components/DashboardLayout";
import NextImage from "next/image";
import { addNotification } from "@/lib/notifications";
import {
  Save,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  CreditCard,
  Bell,
  Shield,
  Palette,
  MessageSquare,
  Printer,
  Hash,
  Percent,
  AlertTriangle,
  AlertCircle,
  Languages,
  Image as ImageIcon,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Pencil,
  Users,
  UserCog,
  User,
  Eye,
  EyeOff,
  UserX,
  Lock,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { sendSMS } from "@/lib/sms";
import AlertPopup from "@/components/AlertPopup";
import { useTheme } from "next-themes";
import { supabase, checkSupabaseConnection } from "@/lib/supabase";

const DEFAULT_SETTINGS = {
  business: {
    name: "",
    logo: "",
    logoX: 50,
    logoY: 50,
    logoZoom: 100,

    phone: "",
    secondaryPhone: "",
    whatsapp: "",
    email: "",
    address: "",
  },
  finance: {
    currency: "BDT",
    invoicePrefix: "INV-",
    defaultPaymentMethod: "Cash",
    paymentMethods: [
      "Cash",
      "Card",
      "bKash",
      "Nagad",
      "Rocket",
      "Bank Transfer",
      "Mobile Banking",
      "Cheque",
      "Other",
    ],
    showPaymentOnChalan: false,
  },
  system: {
    lowStockThreshold: 5,
    defaultWoodPrice: null,
    autoLogoutTime: 5,
    language: "English",
    theme: "light",
    timezone: "Asia/Dhaka",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
  },
  integrations: {
    smsApiKey: "",
    smsSenderId: "",
  },
  printing: {
    paperSize: "A4",
    showWatermark: true,
    footerText: "Thank you for your business!",
  },
  roles: [
    {
      id: "r1",
      name: "Super Admin",
      description: "Complete access to all modules and system settings.",
      permissions: ["All Access"],
    },
    {
      id: "r_admin",
      name: "Admin",
      description: "Comprehensive access to all modules and system settings, excluding database clear/delete actions.",
      permissions: [
        "Dashboard",
        "Financial Summary",
        "solo wood",
        "pos wood",
        "pos furniture",
        "Furniture Invoices",
        "Wood Invoices",
        "Customer",
        "Customer Statement",
        "Bills & Expenses",
        "Furniture Inventory",
        "Wood Inventory",
        "Furniture Category",
        "Wood Category",
        "Staff",
        "Staff Statement",
        "Transaction",
        "SMS",
        "Reports",
        "Settings",
        "Users",
        "Roles",
      ],
    },
    {
      id: "r2",
      name: "Manager",
      description:
        "Can manage inventory, view reports, and handle staff operations.",
      permissions: ["Furniture Inventory", "Wood Inventory", "Furniture Invoices", "Wood Invoices", "Reports", "Staff", "Financial Summary", "Settings"],
    },
    {
      id: "r3",
      name: "Cashier",
      description: "Can create and manage invoices and process sales only.",
      permissions: ["Furniture Invoices", "Wood Invoices", "pos wood", "pos furniture", "Customer"],
    },
    {
      id: "r4",
      name: "Sales Rep",
      description: "Can view inventory and customer statements.",
      permissions: ["solo wood", "Customer Statement"],
    },
  ],
  users: [],
};

const formatProfilePhoneDisplay = (phone: string | undefined): string => {
  if (!phone) return "";
  let clean = phone.trim();
  // If it starts with +8800, replace with +880 (don't show duplicate 0)
  if (clean.startsWith("+8800")) {
    clean = "+880" + clean.slice(5);
  } else if (clean.startsWith("8800")) {
    clean = "880" + clean.slice(4);
  }
  return clean;
};

function SettingsPageContent() {
  const { setTheme } = useTheme();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(tabParam || "profile");
  const [testNumber, setTestNumber] = useState("");
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [showAdjustControls, setShowAdjustControls] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "success",
  });
  const [newMethod, setNewMethod] = useState("");
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(DEFAULT_SETTINGS);
  const [dbStatus, setDbStatus] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const { user, userRole, logout } = useAuth();

  const isSuperAdmin = Boolean(
    userRole?.name === "Super Admin" ||
    userRole?.id === "r1" ||
    user?.role === "Super Admin" ||
    (userRole?.permissions && userRole.permissions.includes("All Access"))
  );

  const canAccessUsers = Boolean(
    isSuperAdmin ||
    (userRole?.permissions && (userRole.permissions.includes("All Access") || userRole.permissions.includes("Users")))
  );

  const canAccessRoles = Boolean(
    isSuperAdmin ||
    (userRole?.permissions && (userRole.permissions.includes("All Access") || userRole.permissions.includes("Roles")))
  );

  const isAdminOrSuperAdmin = Boolean(
    isSuperAdmin ||
    userRole?.name === "Admin" ||
    userRole?.id === "r_admin" ||
    user?.role === "Admin"
  );

  const isManager = Boolean(
    userRole?.name?.toLowerCase().includes("manager") ||
    userRole?.id === "r2" ||
    user?.role?.toLowerCase().includes("manager") ||
    (userRole?.permissions && userRole.permissions.includes("Settings"))
  );

  const canManageSettings = Boolean(
    isAdminOrSuperAdmin ||
    isManager
  );

  useEffect(() => {
    if (activeTab === "users" && !canAccessUsers) {
      setActiveTab("profile");
    }
    if (activeTab === "roles" && !canAccessRoles) {
      setActiveTab("profile");
    }
  }, [activeTab, canAccessUsers, canAccessRoles]);

  useEffect(() => {
    if (tabParam) {
      if (tabParam === "users" && !canAccessUsers) {
        setActiveTab("profile");
      } else if (tabParam === "roles" && !canAccessRoles) {
        setActiveTab("profile");
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, canAccessUsers, canAccessRoles]);

  const isEditingSelf = Boolean(
    user && editingUser && (
      (editingUser.id && user.id && editingUser.id === user.id) ||
      (editingUser.email && user.email && editingUser.email.toLowerCase() === user.email.toLowerCase()) ||
      (editingUser.phone && user.phone && editingUser.phone === user.phone) ||
      (editingUser.username && user.username && editingUser.username.toLowerCase() === user.username.toLowerCase())
    )
  );

  useEffect(() => {
    if (!editingUser || !isUserModalOpen) return;
    
    // Only auto-save if required fields are present
    if (!editingUser.name || !editingUser.roleId) return;

    if (editingUser.password === 'Loading...') return;

    const timer = setTimeout(async () => {
      try {
        const phoneQuery = editingUser.original_phone ? `phone.eq.${editingUser.original_phone}` : (editingUser.phone ? `phone.eq.${editingUser.phone}` : 'phone.eq.---');
        const emailQuery = editingUser.original_email ? `email.eq.${editingUser.original_email}` : (editingUser.email ? `email.eq.${editingUser.email}` : 'email.eq.---');
        const usernameQuery = editingUser.original_username ? `username.eq.${editingUser.original_username}` : (editingUser.username ? `username.eq.${editingUser.username}` : 'username.eq.---');
        const { data: existingUser } = await supabase.from('custom_users')
            .select('id, role').or(`${phoneQuery},${emailQuery},${usernameQuery}`).maybeSingle();

        const currentOrgId = user?.org_id || user?.id || '';
        const userRoleObj = (settings.roles || DEFAULT_SETTINGS.roles).find((r: any) => r.id === editingUser.roleId);
        const assignedRoleName = userRoleObj ? userRoleObj.name : 'Staff';

        if (existingUser) {
            const updateData: any = {
              name: editingUser.name,
              username: editingUser.username || null,
              phone: editingUser.phone || null,
              email: editingUser.email || null,
              org_id: currentOrgId
            };

            // Strict Role Access Control: Only Super Admins can update roles, and users cannot modify their own role.
            if (isSuperAdmin && !isEditingSelf) {
              updateData.role = assignedRoleName;
            }

            if (editingUser.password) {
              updateData.password = editingUser.password;
            }
            await supabase.from('custom_users').update(updateData).eq('id', existingUser.id);
        } else {
            if (editingUser.password) {
              await supabase.from('custom_users').insert({
                name: editingUser.name,
                username: editingUser.username || null,
                phone: editingUser.phone || null,
                email: editingUser.email || null,
                password: editingUser.password,
                role: (isSuperAdmin && !isEditingSelf) ? assignedRoleName : 'Staff',
                org_id: currentOrgId
              });
            }
        }
      } catch (e: any) {
        console.error("Failed to auto-save to custom_users", e);
      }

      setSettings((prev: any) => {
        const currentUsers = prev.users || DEFAULT_SETTINGS.users;
        const existingIndex = currentUsers.findIndex((u: any) => u.id === editingUser.id);
        
        let newUsers = [...currentUsers];
        const userToSave = { ...editingUser };

        // Enforce strict role modification rules
        if (existingIndex >= 0) {
          const prevUser = currentUsers[existingIndex];
          if (prevUser.roleId !== userToSave.roleId) {
            if (isEditingSelf) {
              toast.error("Users cannot change their own roles.");
              userToSave.roleId = prevUser.roleId;
            } else if (!isSuperAdmin) {
              toast.error("Only users with the Super Admin role can assign or modify roles.");
              userToSave.roleId = prevUser.roleId;
            }
          }
        } else if (!isSuperAdmin) {
          toast.error("Only users with the Super Admin role can assign or modify roles.");
          userToSave.roleId = (prev.roles || DEFAULT_SETTINGS.roles).find((r: any) => r.name === 'Staff')?.id || userToSave.roleId;
        }

        delete userToSave.password;
        delete userToSave.original_phone;
        delete userToSave.original_email;
        delete userToSave.original_username;

        if (existingIndex >= 0) {
          newUsers[existingIndex] = userToSave;
        } else {
          newUsers.push({ ...userToSave, id: editingUser.id || `u${Date.now()}` });
        }

        const updatedSettings = { ...prev, users: newUsers };
        
        // Debounced sync to db
        supabase.from("app_settings").upsert({
          id: "global",
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        }).then();
        
        return updatedSettings;
      });
      
      // Update the original_ properties to the new values so subsequent edits use the right query
      setEditingUser((prev: any) => {
          if (!prev) return prev;
          return {
              ...prev,
              original_phone: prev.phone,
              original_email: prev.email,
              original_username: prev.username
          }
      });

    }, 800);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editingUser?.name, 
    editingUser?.username, 
    editingUser?.email, 
    editingUser?.phone, 
    editingUser?.password, 
    editingUser?.roleId, 
    editingUser?.status, 
    isUserModalOpen
  ]);

  // Clear Data Auth States
  const [isClearDataModalOpen, setIsClearDataModalOpen] = useState(false);
  const [clearDataAuthStep, setClearDataAuthStep] = useState<
    "password" | "otp"
  >("password");
  const [clearDataPhone, setClearDataPhone] = useState("");
  const [clearDataPassword, setClearDataPassword] = useState("");
  const [clearDataOtp, setClearDataOtp] = useState("");
  const [clearDataOtpToken, setClearDataOtpToken] = useState<string | null>(
    null,
  );
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Delete Account States
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState<"credentials" | "otp">("credentials");
  const [deletePhone, setDeletePhone] = useState(() => user?.phone ? user.phone.replace(/\D/g, "").slice(-11) : "");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [showDeleteConfirmPassword, setShowDeleteConfirmPassword] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpToken, setDeleteOtpToken] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Auto pre-fill deletePhone when user is loaded or changed
  useEffect(() => {
    if (user?.phone) {
      const formatted = user.phone.replace(/\D/g, "").slice(-11);
      if (formatted.length === 11) {
        setDeletePhone(formatted);
      }
    }
  }, [user]);

  // Change Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Edit Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileUsername, setEditProfileUsername] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setAlertConfig({
        isOpen: true,
        message: "New passwords do not match!",
        type: "error",
      });
      return;
    }
    if (!user || !user.phone) {
      setAlertConfig({
        isOpen: true,
        message: "User verification failed.",
        type: "error",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      // 1. Verify current password
      const { data: userData, error: verifyError } = await supabase
        .from("custom_users")
        .select("id")
        .eq("phone", user.phone)
        .eq("password", currentPassword)
        .single();

      if (verifyError || !userData) {
        throw new Error("Incorrect current password");
      }

      // 2. Update to new password
      const { error: updateError } = await supabase
        .from("custom_users")
        .update({ password: newPassword })
        .eq("id", userData.id);

      if (updateError) throw updateError;

      setAlertConfig({
        isOpen: true,
        message: "Password updated successfully!",
        type: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setAlertConfig({
        isOpen: true,
        message: error.message || "Failed to change password",
        type: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !user.id) return;
    setIsSavingProfile(true);
    try {
      // Preserve the phone format as entered (e.g. 017...) as requested by user
      const normalizedPhone = formatProfilePhoneDisplay(editProfilePhone.trim());

      const { error } = await supabase
        .from("custom_users")
        .update({
          name: editProfileName,
          username: editProfileUsername,
          phone: normalizedPhone,
          email: editProfileEmail,
        })
        .eq("id", user.id);

      if (error) throw error;

      const updatedUser = {
        ...user,
        name: editProfileName,
        username: editProfileUsername,
        phone: normalizedPhone,
        email: editProfileEmail,
      };
      try {
        localStorage.setItem("custom_user", JSON.stringify(updatedUser));
      } catch (e) {
        console.warn('localStorage not available', e);
      }

      setAlertConfig({
        isOpen: true,
        message: "Profile updated successfully! Reloading...",
        type: "success",
      });
      setIsEditingProfile(false);

      setTimeout(() => {
        try {
          window.location.reload();
        } catch (e) {
          console.warn('Reload not supported', e);
        }
      }, 1500);
    } catch (error: any) {
      setAlertConfig({
        isOpen: true,
        message: error.message || "Failed to update profile",
        type: "error",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const ALL_PERMISSIONS = [
    "All Access",
    "Dashboard",
    "Financial Summary",
    "solo wood",
    "pos wood",
    "pos furniture",
    "Furniture Invoices",
    "Wood Invoices",
    "Customer",
    "Customer Statement",
    "Bills & Expenses",
    "Furniture Inventory",
    "Wood Inventory",
    "Furniture Category",
    "Wood Category",
    "Staff",
    "Staff Statement",
    "Transaction",
    "SMS",
    "Reports",
    "Settings",
    "Users",
    "Roles",
  ];

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    fetchSettings();
    handleCheckDb();

    // Subscribe to settings changes
    const settingsChannel = supabase.channel('settings_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: "id=eq.'global'" }, () => {
        fetchSettings();
      })
      .subscribe();

    // Subscribe to user changes
    const usersChannel = supabase.channel('users_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_users' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(usersChannel);
    };
  }, []);

  const handleCheckDb = async () => {
    setIsCheckingDb(true);
    const result = await checkSupabaseConnection();
    setDbStatus(result);
    setIsCheckingDb(false);
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // First try Supabase
      const { data, error } = await supabase
        .from("app_settings")
        .select("settings")
        .eq("id", "global")
        .single();

      if (data && data.settings) {
        let updatedSettings = { ...data.settings };
        
        // Synchronize users with custom_users table
        const { data: dbUsers, error: usersError } = await supabase
          .from("custom_users")
          .select("id, name, phone, email, username");

        if (!usersError && dbUsers) {
          const currentUsers = updatedSettings.users || [];
          // Keep only users that exist in custom_users table
          // Note: we match by identifiers (phone, email, or username) since IDs might differ if they were manual inserts
          const syncedUsers = currentUsers.filter((u: any) => {
            return dbUsers.some((dbU: any) => 
              (u.phone && dbU.phone === u.phone) || 
              (u.email && dbU.email === u.email) || 
              (u.username && dbU.username === u.username)
            );
          });
          
          // If the count changed, we should update the settings
          if (syncedUsers.length !== currentUsers.length) {
            updatedSettings.users = syncedUsers;
            // Optionally update the DB with synced version
            await supabase.from("app_settings").upsert({
              id: "global",
              settings: updatedSettings,
              updated_at: new Date().toISOString(),
            });
          }
        }

        // Load global business settings shared by all users
        let globalBusiness = updatedSettings.business || null;
        if (!globalBusiness || !globalBusiness.name) {
          // Fallback to any business_by_user entry if present from legacy data
          if (updatedSettings.business_by_user) {
            const firstKey = Object.keys(updatedSettings.business_by_user).find(
              (k) => updatedSettings.business_by_user[k]?.name
            );
            if (firstKey) {
              globalBusiness = updatedSettings.business_by_user[firstKey];
            }
          }
        }

        updatedSettings.business = {
          name: globalBusiness?.name || "",
          logo: globalBusiness?.logo || "",
          logoX: globalBusiness?.logoX ?? 50,
          logoY: globalBusiness?.logoY ?? 50,
          logoZoom: globalBusiness?.logoZoom ?? 100,
          phone: globalBusiness?.phone || "",
          secondaryPhone: globalBusiness?.secondaryPhone || "",
          whatsapp: globalBusiness?.whatsapp || "",
          email: globalBusiness?.email || "",
          address: globalBusiness?.address || "",
        };

        // Ensure Admin role is present in roles array and has Users & Roles permissions
        if (updatedSettings.roles) {
          const adminIndex = updatedSettings.roles.findIndex((r: any) => r.name === "Admin" || r.id === "r_admin");
          if (adminIndex >= 0) {
            const admin = updatedSettings.roles[adminIndex];
            const perms = admin.permissions || [];
            let changed = false;
            if (!perms.includes("Users")) { perms.push("Users"); changed = true; }
            if (!perms.includes("Roles")) { perms.push("Roles"); changed = true; }
            if (changed) {
              updatedSettings.roles[adminIndex] = { ...admin, permissions: perms };
            }
          } else {
            const adminRole = {
              id: "r_admin",
              name: "Admin",
              description: "Comprehensive access to all modules and system settings, excluding database clear/delete actions.",
              permissions: [
                "Dashboard",
                "Financial Summary",
                "solo wood",
                "pos wood",
                "pos furniture",
                "Furniture Invoices",
                "Wood Invoices",
                "Customer",
                "Customer Statement",
                "Bills & Expenses",
                "Furniture Inventory",
                "Wood Inventory",
                "Furniture Category",
                "Wood Category",
                "Staff",
                "Staff Statement",
                "Transaction",
                "SMS",
                "Reports",
                "Settings",
                "Users",
                "Roles",
              ],
            };
            updatedSettings.roles = [updatedSettings.roles[0], adminRole, ...updatedSettings.roles.slice(1)];
          }
        }

        setSettings(updatedSettings);
      }
    } catch (err) {
      console.warn("Supabase settings fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canManageSettings) {
      setAlertConfig({
        isOpen: true,
        message: "You do not have permission to modify settings.",
        type: "error",
      });
      return;
    }
    try {
      // Save global settings directly
      const updatedSettings = { ...settings };

      if (user?.id) {
        if (!updatedSettings.business_by_user) {
          updatedSettings.business_by_user = {};
        }
        updatedSettings.business_by_user[user.id] = updatedSettings.business;
      }

      // Save to Supabase
      const { error } = await supabase.from("app_settings").upsert({
        id: "global",
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      if (settings.system?.theme) {
        setTheme(settings.system.theme);
      }

      // Update localStorage for client cache
      try {
        if (settings.business?.name !== undefined) {
          localStorage.setItem('business_name', settings.business.name.trim());
        }
        if (settings.business?.logo !== undefined) {
          localStorage.setItem('business_logo', settings.business.logo || '');
        }
        if (settings.business?.logoX !== undefined) {
          localStorage.setItem('business_logo_x', (settings.business.logoX ?? 50).toString());
        }
        if (settings.business?.logoY !== undefined) {
          localStorage.setItem('business_logo_y', (settings.business.logoY ?? 50).toString());
        }
        if (settings.business?.logoZoom !== undefined) {
          localStorage.setItem('business_logo_zoom', (settings.business.logoZoom ?? 100).toString());
        }
      } catch (e) {
        console.warn('localStorage update failed:', e);
      }

      // Dispatch custom events for real-time header/sidebar sync
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('settings_updated'));

      addNotification('settings_update', 'Settings Saved', 'Global application settings have been updated.');

      setAlertConfig({
        isOpen: true,
        message: "Settings saved successfully to cloud!",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setAlertConfig({
        isOpen: true,
        message: "Settings save failed: " + (error.message || "Unknown error"),
        type: "error",
      });
    }
  };

  const updateSetting = (section: string, field: string, value: any) => {
    setSettings((prev: any) => {
      const updatedSection = {
        ...prev[section],
        [field]: value,
      };
      
      const newSettings = {
        ...prev,
        [section]: updatedSection,
      };

      return newSettings;
    });

    // Apply theme immediately if it's the theme setting
    if (section === "system" && field === "theme") {
      setTheme(value);
    }
  };

  const tabs = [
    { id: "profile", name: "Business Profile", icon: Building2 },
    { id: "my_profile", name: "My Profile", icon: User },
    ...(canAccessUsers ? [{ id: "users", name: "Users", icon: Users }] : []),
    ...(canAccessRoles ? [{ id: "roles", name: "Roles", icon: UserCog }] : []),
    { id: "finance", name: "Finance & Invoicing", icon: CreditCard },
    { id: "system", name: "System Config", icon: Shield },
    { id: "integrations", name: "SMS & API", icon: MessageSquare },
    { id: "database", name: "Database Status", icon: AlertCircle },
    { id: "printing", name: "Print Settings", icon: Printer },
  ];

  const handleTestSms = async () => {
    if (!testNumber) {
      setAlertConfig({
        isOpen: true,
        message: "Please enter a test phone number",
        type: "warning",
      });
      return;
    }
    setIsTestingSms(true);
    try {
      await sendSMS(testNumber, "Test message from FurniTrack Settings 🚀", {
        apiKey: settings.integrations?.smsApiKey,
        senderId: settings.integrations?.smsSenderId,
      });
    } catch (error: any) {
      console.error("Test SMS failed:", error);
    } finally {
      setIsTestingSms(false);
    }
  };

  const openClearDataModal = () => {
    if (!isSuperAdmin) {
      toast.error("Only users with the Super Admin role can clear database data.");
      return;
    }
    setIsClearDataModalOpen(true);
    setClearDataAuthStep("password");
    setClearDataPhone(user?.phone || "");
    setClearDataPassword("");
    setClearDataOtp("");
    setClearDataOtpToken(null);
    setAuthError(null);
  };

  const handleRequestClearOTP = async () => {
    try {
      setAuthError(null);
      setIsAuthenticating(true);

      if (!clearDataPhone || !clearDataPassword) {
        throw new Error("Please enter both phone and password.");
      }

      // Check credentials first
      const { data, error } = await supabase
        .from("custom_users")
        .select("*")
        .eq("phone", clearDataPhone)
        .eq("password", clearDataPassword)
        .single();

      if (error || !data) {
        throw new Error("Invalid phone or password.");
      }

      // Send OTP
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: clearDataPhone,
          isDemo: false,
        }),
      });

      const otpRes = await res.json();
      if (!res.ok) throw new Error(otpRes.error || "Failed to send OTP");
      if (otpRes.otpToken) {
        setClearDataOtpToken(otpRes.otpToken);
      }

      setClearDataAuthStep("otp");
      setAlertConfig({
        isOpen: true,
        message: otpRes.message || "OTP sent successfully",
        type: "success",
      });
    } catch (error: any) {
      setAuthError(
        error.message === "Failed to fetch"
          ? "Network error: Failed to reach the server. Please check your connection."
          : error.message,
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVerifyClearOTP = async () => {
    try {
      setAuthError(null);
      setIsAuthenticating(true);

      if (!clearDataOtp || !clearDataOtpToken) {
        throw new Error("Please enter the OTP code.");
      }

      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: clearDataPhone,
          otp: clearDataOtp,
          otpToken: clearDataOtpToken,
          isDemo: false,
        }),
      });

      const resData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(resData.error || "Invalid OTP");

      // Proceed to clear database
      await handleClearDatabaseAction();

      setIsClearDataModalOpen(false);
    } catch (error: any) {
      setAuthError(
        error.message === "Failed to fetch"
          ? "Network error: Failed to reach the server. Please check your connection."
          : error.message,
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleClearDatabaseAction = async () => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admins can clear database data.");
      return;
    }
    setIsClearingDb(true);
    try {
      // Execute deletions in order to respect foreign key constraints
      const tablesToDelete = [
        "transactions",
        "bills",
        "furniture_inventory",
        "wood_inventory",
        "customer",
        "staff",
      ];

      for (const table of tablesToDelete) {
        const { error } = await supabase
          .from(table)
          .delete()
          .not("id", "is", null);
        if (error) {
          console.error(`Error deleting from ${table}:`, error);
          // We can choose to continue or throw
          throw error;
        }
      }

      setAlertConfig({
        isOpen: true,
        message: "Successfully cleared all database tables.",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error clearing database:", error);
      setAlertConfig({
        isOpen: true,
        message:
          "Failed to clear database: " + (error.message || "Unknown error"),
        type: "error",
      });
    } finally {
      setIsClearingDb(false);
    }
  };

  const openDeleteAccountModal = () => {
    if (!isSuperAdmin) {
      toast.error("Only users with the Super Admin role can delete account data.");
      return;
    }
    setIsDeleteAccountModalOpen(true);
    setDeleteAccountStep("credentials");
    setDeletePhone(user?.phone ? user.phone.replace(/\D/g, "").slice(-11) : "");
    setDeletePassword("");
    setDeleteConfirmPassword("");
    setShowDeletePassword(false);
    setShowDeleteConfirmPassword(false);
    setDeleteOtp("");
    setDeleteOtpToken(null);
    setDeleteAccountError(null);
  };

  const handleRequestDeleteOTP = async () => {
    try {
      setDeleteAccountError(null);
      setIsDeletingAccount(true);

      const cleanPhone = deletePhone.trim();
      if (!cleanPhone || cleanPhone.length !== 11 || !/^\d{11}$/.test(cleanPhone)) {
        throw new Error("Please enter a valid 11-digit phone number.");
      }

      if (!deletePassword) {
        throw new Error("Please enter your password.");
      }

      if (!deleteConfirmPassword) {
        throw new Error("Please confirm your password.");
      }

      if (deletePassword !== deleteConfirmPassword) {
        throw new Error("Passwords do not match.");
      }

      // Ensure the provided phone number matches the logged in user's profile
      if (user?.phone) {
        const loggedInPhoneDigits = user.phone.replace(/\D/g, "").slice(-11);
        const inputPhoneDigits = cleanPhone.replace(/\D/g, "").slice(-11);
        if (loggedInPhoneDigits && inputPhoneDigits !== loggedInPhoneDigits) {
          throw new Error("The entered phone number does not match your logged-in account profile.");
        }
      }

      // Validate against authentication system (custom_users table)
      let authenticated = false;
      try {
        let query = supabase.from("custom_users").select("*");
        if (user?.id) {
          query = query.eq("id", user.id);
        } else if (user?.phone) {
          const cleanUserPhone = user.phone.replace(/\D/g, "").slice(-11);
          query = query.or(`phone.eq.${cleanUserPhone},phone.eq.+880${cleanUserPhone.replace(/^0/, "")}`);
        } else if (user?.email) {
          query = query.eq("email", user.email);
        } else if (user?.username) {
          query = query.eq("username", user.username);
        } else {
          query = query.or(`phone.eq.${cleanPhone},phone.eq.+880${cleanPhone.replace(/^0/, "")}`);
        }

        const { data: dbUser } = await query.maybeSingle();

        if (dbUser) {
          if (dbUser.password && dbUser.password !== deletePassword) {
            throw new Error("Incorrect account password.");
          }
          if (dbUser.phone) {
            const dbPhoneDigits = dbUser.phone.replace(/\D/g, "").slice(-11);
            const inputPhoneDigits = cleanPhone.replace(/\D/g, "").slice(-11);
            if (dbPhoneDigits && inputPhoneDigits !== dbPhoneDigits) {
              throw new Error("The phone number does not match your authentication system records.");
            }
          }
          authenticated = true;
        }
      } catch (e: any) {
        if (e.message && (e.message.includes("Incorrect account password") || e.message.includes("does not match"))) {
          throw e;
        }
        console.warn("Auth system validation error:", e);
      }

      if (!authenticated && user) {
        const loggedInPhoneDigits = user.phone ? user.phone.replace(/\D/g, "").slice(-11) : "";
        const inputPhoneDigits = cleanPhone.replace(/\D/g, "").slice(-11);
        if (loggedInPhoneDigits && inputPhoneDigits !== loggedInPhoneDigits) {
          throw new Error("The entered phone number does not match your logged-in account profile.");
        }
        authenticated = true;
      }

      if (!authenticated) {
        throw new Error("Invalid phone number or account password.");
      }

      // Send OTP code
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          isDemo: false,
        }),
      });

      const otpRes = await res.json();
      if (!res.ok) throw new Error(otpRes.error || "Failed to send OTP verification code.");
      if (otpRes.otpToken) {
        setDeleteOtpToken(otpRes.otpToken);
      }

      setDeleteAccountStep("otp");
      setAlertConfig({
        isOpen: true,
        message: otpRes.message || "OTP verification code sent successfully.",
        type: "success",
      });
    } catch (error: any) {
      setDeleteAccountError(
        error.message === "Failed to fetch"
          ? "Network error: Failed to reach the server. Please check your connection."
          : error.message
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleVerifyDeleteOTPAndExecute = async () => {
    try {
      setDeleteAccountError(null);
      setIsDeletingAccount(true);

      const cleanOtp = deleteOtp.trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        throw new Error("Please enter the 6-digit OTP code.");
      }

      if (!deleteOtpToken) {
        throw new Error("OTP session expired. Please request a new OTP code.");
      }

      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: deletePhone.trim(),
          otp: cleanOtp,
          otpToken: deleteOtpToken,
          isDemo: false,
        }),
      });

      const resData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(resData.error || "Invalid OTP code.");

      // OTP verified! Permanently delete account data and organization records in Supabase
      const userId = user?.id;
      const cleanPhone = deletePhone.trim();
      let targetOrgId = user?.org_id;

      // 1. Retrieve org_id and user details if missing
      if (!targetOrgId && cleanPhone) {
        const phoneFormatted = `+880${cleanPhone.replace(/^0/, "")}`;
        try {
          const { data: dbUser } = await supabase
            .from("custom_users")
            .select("id, org_id")
            .or(`phone.eq.${cleanPhone},phone.eq.${phoneFormatted}`)
            .maybeSingle();

          if (dbUser?.org_id) {
            targetOrgId = dbUser.org_id;
          }
        } catch (e) {
          console.warn("Error looking up custom_users org_id by phone:", e);
        }
      }

      if (!targetOrgId && userId) {
        try {
          const { data: dbUser } = await supabase
            .from("custom_users")
            .select("org_id")
            .eq("id", userId)
            .maybeSingle();

          if (dbUser?.org_id) {
            targetOrgId = dbUser.org_id;
          }
        } catch (e) {
          console.warn("Error looking up custom_users org_id by userId:", e);
        }
      }

      if (!targetOrgId) {
        targetOrgId = userId;
      }

      // 2. Permanently delete all records across all tables associated with org_id
      const orgTables = [
        "furniture_invoice_items",
        "wood_invoice_items",
        "furniture_invoices",
        "wood_invoices",
        "furniture_inventory",
        "wood_inventory",
        "furniture_category",
        "wood_category",
        "wood_category_car",
        "wood_category_tag",
        "customer",
        "staff",
        "bills",
        "transactions",
        "sms_history",
        "make_excel_file",
      ];

      if (targetOrgId) {
        for (const tableName of orgTables) {
          try {
            await supabase.from(tableName).delete().eq("org_id", targetOrgId);
          } catch (e) {
            console.warn(`Error deleting records from ${tableName} for org_id:`, e);
          }
        }
      }

      // Also clean up by user_id where applicable as additional safeguard
      if (userId) {
        const userTables = ["transactions", "bills", "sms_history"];
        for (const tableName of userTables) {
          try {
            await supabase.from(tableName).delete().eq("user_id", userId);
          } catch (e) {
            console.warn(`Error deleting records from ${tableName} for user_id:`, e);
          }
        }
      }

      // 3. Delete user & organization entries from custom_users table explicitly
      try {
        if (targetOrgId) {
          const { error: orgErr } = await supabase.from("custom_users").delete().eq("org_id", targetOrgId);
          if (orgErr) console.warn("Error deleting custom_users by org_id:", orgErr);
        }
        if (userId) {
          const { error: idErr } = await supabase.from("custom_users").delete().eq("id", userId);
          if (idErr) console.warn("Error deleting custom_users by id:", idErr);
        }
        if (user?.username) {
          const { error: unameErr } = await supabase.from("custom_users").delete().eq("username", user.username);
          if (unameErr) console.warn("Error deleting custom_users by username:", unameErr);
        }
        if (user?.email) {
          const { error: emailErr } = await supabase.from("custom_users").delete().eq("email", user.email);
          if (emailErr) console.warn("Error deleting custom_users by email:", emailErr);
        }
        if (cleanPhone) {
          const phoneFormatted = `+880${cleanPhone.replace(/^0/, "")}`;
          const { error: phoneErr } = await supabase.from("custom_users").delete().or(`phone.eq.${cleanPhone},phone.eq.${phoneFormatted}`);
          if (phoneErr) console.warn("Error deleting custom_users by phone:", phoneErr);
        }
      } catch (e) {
        console.warn("Error deleting from custom_users:", e);
      }

      // 4. Delete org-specific app_settings record if it exists
      if (targetOrgId) {
        try {
          await supabase.from("app_settings").delete().eq("id", targetOrgId);
        } catch (e) {
          console.warn("Error deleting org app_settings:", e);
        }
      }

      // 5. Delete user profile and business settings from global app_settings
      try {
        const { data: currentSettingsData } = await supabase
          .from("app_settings")
          .select("settings")
          .eq("id", "global")
          .single();

        if (currentSettingsData && currentSettingsData.settings) {
          const currentSettings = currentSettingsData.settings as any;
          let updatedUsers = currentSettings.users || [];
          if (userId) {
            updatedUsers = updatedUsers.filter((u: any) => u.id !== userId);
          }
          if (targetOrgId) {
            updatedUsers = updatedUsers.filter((u: any) => u.org_id !== targetOrgId && u.id !== targetOrgId);
          }
          if (cleanPhone) {
            updatedUsers = updatedUsers.filter((u: any) => u.phone !== cleanPhone);
          }

          const updatedBusinessByUser = { ...(currentSettings.business_by_user || {}) };
          const updatedOnboardingCompleted = { ...(currentSettings.onboarding_completed_by_user || {}) };
          const updatedOnboardingSkipped = { ...(currentSettings.onboarding_skipped_by_user || {}) };

          if (userId) {
            delete updatedBusinessByUser[userId];
            delete updatedOnboardingCompleted[userId];
            delete updatedOnboardingSkipped[userId];
          }
          if (targetOrgId) {
            delete updatedBusinessByUser[targetOrgId];
            delete updatedOnboardingCompleted[targetOrgId];
            delete updatedOnboardingSkipped[targetOrgId];
          }

          const updatedGlobalSettings = {
            ...currentSettings,
            users: updatedUsers,
            business_by_user: updatedBusinessByUser,
            onboarding_completed_by_user: updatedOnboardingCompleted,
            onboarding_skipped_by_user: updatedOnboardingSkipped,
          };

          await supabase.from("app_settings").upsert({
            id: "global",
            settings: updatedGlobalSettings,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("Error updating app_settings during account deletion:", e);
      }

      // 6. Clear local storage and log out
      localStorage.removeItem("custom_user");
      localStorage.removeItem("business_name");
      localStorage.removeItem("business_logo");
      if (userId) {
        localStorage.removeItem(`onboarding_status_${userId}`);
        localStorage.removeItem(`just_signed_up_${userId}`);
      }
      if (targetOrgId) {
        localStorage.removeItem(`onboarding_status_${targetOrgId}`);
        localStorage.removeItem(`just_signed_up_${targetOrgId}`);
      }

      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn("Supabase auth signout error:", e);
      }

      setIsDeleteAccountModalOpen(false);
      toast.success("Organization and all associated data permanently deleted.");
      logout();
    } catch (error: any) {
      setDeleteAccountError(
        error.message === "Failed to fetch"
          ? "Network error: Failed to reach the server. Please check your connection."
          : error.message
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <>
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                Settings
              </h1>
            </div>
            {isAdminOrSuperAdmin ? (
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 max-sm:w-[180px] max-sm:-mt-[45px] max-sm:ml-[155px] -mt-[10px] -mb-[5px] sm:w-auto sm:ml-0"
              >
                <Save size={18} /> Save Changes
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 max-sm:w-[180px] max-sm:-mt-[45px] max-sm:ml-[155px] -mt-[10px] -mb-[5px] sm:w-auto sm:ml-0">
                <Shield size={14} /> Read-Only Mode
              </div>
            )}
          </div>

          <div className="flex flex-col md:grid md:grid-cols-4 gap-6">
            {/* Sidebar Navigation */}
            <div className="flex overflow-x-auto pb-2 md:pb-0 md:flex-col gap-2 scrollbar-none md:max-lg:w-[185px]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-xl font-medium text-left transition-all whitespace-nowrap shrink-0",
                    activeTab === tab.id
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                      : "text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm",
                  )}
                >
                  <tab.icon size={18} className="shrink-0" />
                  <span className="text-sm md:text-base">{tab.name}</span>
                </button>
              ))}
            </div>

            {/* Settings Content */}
            <div className="md:col-span-3">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                {activeTab === "my_profile" && (
                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          My Profile
                        </h3>
                        {user && !isEditingProfile && (
                          <button
                            onClick={() => {
                              setEditProfileName(user.name || "");
                              setEditProfileUsername(user.username || "");
                              setEditProfilePhone(formatProfilePhoneDisplay(user.phone) || "");
                              setEditProfileEmail(user.email || "");
                              setIsEditingProfile(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                          >
                            <Pencil size={16} /> Edit Profile
                          </button>
                        )}
                      </div>
                      {user ? (
                        isEditingProfile ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div>
                              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={editProfileName}
                                onChange={(e) =>
                                  setEditProfileName(e.target.value)
                                }
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                User Name
                              </label>
                              <input
                                type="text"
                                value={editProfileUsername}
                                onChange={(e) =>
                                  setEditProfileUsername(e.target.value)
                                }
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Phone
                              </label>
                              <input
                                type="text"
                                value={editProfilePhone}
                                onChange={(e) => setEditProfilePhone(e.target.value)}
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Email
                              </label>
                              <input
                                type="email"
                                value={editProfileEmail}
                                onChange={(e) =>
                                  setEditProfileEmail(e.target.value)
                                }
                                className="w-full mt-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                              />
                            </div>
                            <div className="sm:col-span-2 flex justify-end gap-3 mt-4">
                              <button
                                onClick={() => setIsEditingProfile(false)}
                                className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-bold transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveProfile}
                                disabled={isSavingProfile}
                                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
                              >
                                {isSavingProfile ? "Saving..." : "Save Profile"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div>
                              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Full Name
                              </p>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                                {user.name}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                User Name
                              </p>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                                {user.username || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Phone
                              </p>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                                {formatProfilePhoneDisplay(user.phone) || "N/A"}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                Email
                              </p>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                                {user.email || "N/A"}
                              </p>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-4 text-center text-slate-500">
                          Not authenticated.
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                        Change Password
                      </h3>
                      <form
                        onSubmit={handleChangePassword}
                        className="max-w-md space-y-4"
                      >
                        <div>
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Current Password
                          </label>
                          <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            New Password
                          </label>
                          <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isChangingPassword}
                          className="w-full mt-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-600/20"
                        >
                          {isChangingPassword
                            ? "Updating..."
                            : "Update Password"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {activeTab === "profile" && (
                  <div className="space-y-6 sm:h-[460px] md:max-lg:w-[520px] md:max-lg:h-[595px] md:max-lg:mt-0 md:max-lg:-ml-[13px]">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6" style={{ marginTop: "-10px" }}>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Business Profile
                      </h3>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new Event('open_onboarding_modal'))}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Sparkles size={14} /> Launch Setup Wizard
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-8 items-start">
                      <div className="space-y-4 mt-[-10px] sm:mt-[-8px]" style={{ width: "150px", height: "206px", marginBottom: "10px", marginLeft: "0px", marginRight: "0px" }}>
                        <label
                          className="text-sm font-bold text-slate-700 dark:text-slate-300"
                          style={{ marginLeft: "20px" }}
                        >
                          Business Logo
                        </label>
                        <div className="relative group w-32 h-32" style={{ marginLeft: "21px", marginTop: "10px" }}>
                          <label className={cn("block w-full h-full rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative", isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-90")}>
                            {settings.business?.logo ? (
                              <NextImage
                                src={settings.business.logo}
                                alt="Logo"
                                fill
                                sizes="128px"
                                className="object-cover"
                                style={{
                                  objectPosition: `${settings.business?.logoX ?? 50}% ${settings.business?.logoY ?? 50}%`,
                                  transform: `translate(${((settings.business?.logoX ?? 50) - 50)}%, ${((settings.business?.logoY ?? 50) - 50)}%) scale(${(settings.business?.logoZoom ?? 100) / 100})`,
                                  transformOrigin: "center",
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-400">
                                <ImageIcon size={32} />
                                <span className="text-[10px] font-bold">
                                  Upload
                                </span>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={!canManageSettings}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                try {
                                  const fileExt = file.name.split(".").pop();
                                  const fileName = `logo-${Date.now()}.${fileExt}`;
                                  const { error } = await supabase.storage
                                    .from("logos")
                                    .upload(fileName, file);

                                  if (error) throw error;

                                  const { data: urlData } = supabase.storage
                                    .from("logos")
                                    .getPublicUrl(fileName);

                                  updateSetting(
                                    "business",
                                    "logo",
                                    urlData.publicUrl,
                                  );
                                } catch (error: any) {
                                  console.warn(
                                    "Storage upload failed or was restricted. Falling back to inline base64 image encoding:",
                                    error,
                                  );
                                  try {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      if (reader.result) {
                                        updateSetting(
                                          "business",
                                          "logo",
                                          reader.result as string,
                                        );
                                        setAlertConfig({
                                          isOpen: true,
                                          message:
                                            "Logo loaded as inline data due to storage policy limits.",
                                          type: "success",
                                        });
                                      } else {
                                        setAlertConfig({
                                          isOpen: true,
                                          message: "Failed to convert logo to inline data.",
                                          type: "error",
                                        });
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  } catch (encodeError: any) {
                                    console.error("Error uploading logo:", error);
                                    setAlertConfig({
                                      isOpen: true,
                                      message:
                                        "Logo upload failed: " +
                                        (error.message || "Unknown error"),
                                      type: "error",
                                    });
                                  }
                                }
                              }}
                            />
                          </label>
                          {settings.business?.logo && isSuperAdmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!settings.business?.logo) return;

                                try {
                                  const logoUrl = settings.business.logo;

                                  // If it contains 'supabase.co', try to remove from storage
                                  if (logoUrl.includes("supabase.co")) {
                                    const url = new URL(logoUrl);
                                    const parts = url.pathname.split("/");
                                    const fileName = parts.pop();

                                    if (fileName) {
                                      const { error } = await supabase.storage
                                        .from("logos")
                                        .remove([fileName]);

                                      if (error) throw error;
                                    }
                                  }

                                  updateSetting("business", "logo", null);
                                } catch (error: any) {
                                  console.error("Error removing logo:", error);
                                  setAlertConfig({
                                    isOpen: true,
                                    message:
                                      "Logo removal failed: " +
                                      (error.message || "Unknown error"),
                                    type: "error",
                                  });
                                }
                              }}
                              className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-full text-rose-500 hover:text-rose-700 shadow-md transition-all opacity-0 group-hover:opacity-100"
                              title="Remove Logo"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {settings.business?.logo && isSuperAdmin && (
                          <div className="w-[150px] ml-[150px] -mt-[160px] mb-0 sm:mt-[18px] sm:ml-0 sm:mb-0 space-y-3" style={{ width: "150px" }}>
                            <button
                              type="button"
                              onClick={() => setShowAdjustControls(!showAdjustControls)}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all w-full justify-center border border-slate-200/50 dark:border-slate-700/50"
                              style={{ height: "30.2083px", width: "130px", marginLeft: "10px" }}
                            >
                              <Palette size={14} />
                              {showAdjustControls ? "Hide Adjustments" : "Adjust Logo"}
                            </button>
                            
                            {showAdjustControls && (
                              <div
                                className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 w-full"
                                style={{ width: "137px", marginLeft: "7px" }}
                              >
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reposition</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateSetting("business", "logoX", 50);
                                      updateSetting("business", "logoY", 50);
                                      updateSetting("business", "logoZoom", 100);
                                    }}
                                    className="p-1 rounded-md text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center"
                                    title="Reset to Center"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                </div>
                                
                                <div className="space-y-3">
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                      <span>Horizontal (X):</span>
                                      <span>{settings.business?.logoX ?? 50}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={settings.business?.logoX ?? 50}
                                      onChange={(e) => updateSetting("business", "logoX", parseInt(e.target.value))}
                                      className="w-full accent-amber-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer appearance-none"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                      <span>Vertical (Y):</span>
                                      <span>{settings.business?.logoY ?? 50}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={settings.business?.logoY ?? 50}
                                      onChange={(e) => updateSetting("business", "logoY", parseInt(e.target.value))}
                                      className="w-full accent-amber-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer appearance-none"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                      <span>Zoom / Scale:</span>
                                      <span>{settings.business?.logoZoom ?? 100}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="50"
                                      max="200"
                                      value={settings.business?.logoZoom ?? 100}
                                      onChange={(e) => updateSetting("business", "logoZoom", parseInt(e.target.value))}
                                      className="w-full accent-amber-600 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer appearance-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 grid grid-cols-1 gap-6 w-full">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Business Name
                          </label>
                          <input
                            type="text"
                            disabled={!isSuperAdmin}
                            value={settings.business?.name}
                            onChange={(e) =>
                              updateSetting("business", "name", e.target.value)
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 md:max-lg:grid-cols-1 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Phone
                            </label>
                            <input
                              type="text"
                              disabled={!isSuperAdmin}
                              value={settings.business?.phone || ""}
                              onChange={(e) =>
                                updateSetting(
                                  "business",
                                  "phone",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Secondary Phone
                            </label>
                            <input
                              type="text"
                              disabled={!isSuperAdmin}
                              value={settings.business?.secondaryPhone || ""}
                              onChange={(e) =>
                                updateSetting(
                                  "business",
                                  "secondaryPhone",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              WhatsApp
                            </label>
                            <input
                              type="text"
                              disabled={!isSuperAdmin}
                              value={settings.business?.whatsapp || ""}
                              onChange={(e) =>
                                updateSetting(
                                  "business",
                                  "whatsapp",
                                  e.target.value,
                                )
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Email
                          </label>
                          <input
                            type="email"
                            disabled={!isSuperAdmin}
                            value={settings.business?.email}
                            onChange={(e) =>
                              updateSetting("business", "email", e.target.value)
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Address
                          </label>
                          <textarea
                            rows={3}
                            disabled={!isSuperAdmin}
                            value={settings.business?.address}
                            onChange={(e) =>
                              updateSetting(
                                "business",
                                "address",
                                e.target.value,
                              )
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "users" && canAccessUsers && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        User Management
                      </h3>
                      <button
                        onClick={() => {
                          setEditingUser({
                            id: `u${Date.now()}`,
                            name: "",
                            email: "",
                            username: "",
                            phone: "",
                            password: "",
                            roleId:
                              (settings.roles || DEFAULT_SETTINGS.roles)[0]
                                ?.id || "",
                            status: "active",
                          });
                          setIsUserModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                      >
                        <Plus size={16} /> Add User
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {(settings.users || DEFAULT_SETTINGS.users).map(
                        (user: any) => {
                          const role = (
                            settings.roles || DEFAULT_SETTINGS.roles
                          ).find((r: any) => r.id === user.roleId);
                          return (
                            <div
                              key={user.id}
                              className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                  <span className="text-lg font-bold text-slate-600 dark:text-slate-300">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 dark:text-slate-100">
                                      {user.name}
                                    </h4>
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 text-xs font-bold rounded",
                                        user.status === "active"
                                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400",
                                      )}
                                    >
                                      {user.status === "active"
                                        ? "Active"
                                        : "Inactive"}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                      {user.email || "No email"}
                                    </span>
                                    {user.phone && (
                                      <>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                          {user.phone}
                                        </span>
                                      </>
                                    )}
                                    {user.username && (
                                      <>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-sm text-slate-500 dark:text-slate-400">
                                          @{user.username}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-md">
                                      {role?.name || "Unknown Role"}
                                    </span>
                                    {user.lastLogin && (
                                      <span className="text-xs text-slate-400">
                                        Last login:{" "}
                                        {new Date(
                                          user.lastLogin,
                                        ).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={async () => {
                                    setEditingUser({ 
                                      ...user, 
                                      password: 'Loading...',
                                      original_phone: user.phone,
                                      original_email: user.email,
                                      original_username: user.username 
                                    });
                                    setIsUserModalOpen(true);
                                    
                                    if (user.phone || user.email || user.username) {
                                      const phoneQuery = user.phone ? `phone.eq.${user.phone}` : 'phone.eq.---';
                                      const emailQuery = user.email ? `email.eq.${user.email}` : 'email.eq.---';
                                      const usernameQuery = user.username ? `username.eq.${user.username}` : 'username.eq.---';
                                      
                                      const { data } = await supabase.from('custom_users')
                                        .select('password')
                                        .or(`${phoneQuery},${emailQuery},${usernameQuery}`)
                                        .maybeSingle();
                                        
                                      setEditingUser((prev: any) => ({ ...prev, password: data?.password || '' }));
                                    } else {
                                      setEditingUser((prev: any) => ({ ...prev, password: '' }));
                                    }
                                  }}
                                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                  title="Edit User"
                                >
                                  <Pencil size={18} />
                                </button>
                                <button
                                  onClick={() => setUserToDelete(user)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "roles" && canAccessRoles && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Role Management
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Define access permissions and security policies for
                          users.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!isSuperAdmin) {
                            toast.error("Only users with the Super Admin role can assign or modify roles.");
                            return;
                          }
                          setEditingRole({
                            id: `r${Date.now()}`,
                            name: "",
                            description: "",
                            permissions: [],
                          });
                          setIsRoleModalOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                      >
                        <Plus size={16} /> Create Role
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {(settings.roles || DEFAULT_SETTINGS.roles).map(
                        (role: any) => (
                          <div
                            key={role.id}
                            className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100">
                                  {role.name}
                                </h4>
                                {role.name === "Super Admin" && (
                                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded">
                                    System Default
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {role.description}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-2 pt-2">
                                {role.permissions.map((perm: string) => (
                                  <span
                                    key={perm}
                                    className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-md"
                                  >
                                    {perm}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  if (!isSuperAdmin) {
                                    toast.error("Only users with the Super Admin role can assign or modify roles.");
                                    return;
                                  }
                                  setEditingRole({ ...role });
                                  setIsRoleModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                title="Edit Role"
                              >
                                <Pencil size={18} />
                              </button>
                              {role.name !== "Super Admin" && (
                                <button
                                  onClick={() => {
                                    if (!isSuperAdmin) {
                                      toast.error("Only users with the Super Admin role can assign or modify roles.");
                                      return;
                                    }
                                    const newRoles = (
                                      settings.roles || DEFAULT_SETTINGS.roles
                                    ).filter((r: any) => r.id !== role.id);
                                    setSettings((prev: any) => {
                                      const updatedSettings = { ...prev, roles: newRoles };
                                      supabase.from("app_settings").upsert({
                                        id: "global",
                                        settings: updatedSettings,
                                        updated_at: new Date().toISOString(),
                                      }).then(({ error }) => {
                                        if (error) console.error("Error saving roles:", error);
                                      });
                                      return updatedSettings;
                                    });
                                  }}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                  title="Delete Role"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "finance" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
                      Finance & Invoicing
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Currency Symbol
                        </label>
                        <div className="relative">
                          <CreditCard
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <input
                            type="text"
                            disabled={!canManageSettings}
                            value={settings.finance?.currency}
                            onChange={(e) =>
                              updateSetting(
                                "finance",
                                "currency",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Invoice Prefix
                        </label>
                        <div className="relative">
                          <Hash
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <input
                            type="text"
                            disabled={!canManageSettings}
                            value={settings.finance?.invoicePrefix}
                            onChange={(e) =>
                              updateSetting(
                                "finance",
                                "invoicePrefix",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Default Payment Method
                        </label>
                        <select
                          disabled={!canManageSettings}
                          value={settings.finance?.defaultPaymentMethod}
                          onChange={(e) =>
                            updateSetting(
                              "finance",
                              "defaultPaymentMethod",
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        >
                          {(
                            settings.finance?.paymentMethods || [
                              "Cash",
                              "Card",
                              "bKash",
                              "Nagad",
                              "Rocket",
                              "Bank Transfer",
                              "Mobile Banking",
                              "Cheque",
                              "Other",
                            ]
                          ).map((method: string) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Chalan Settings
                        </label>
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-[46px]">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Show Payments
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Applies exclusively to Wood Invoices
                            </span>
                          </div>
                          <button
                            disabled={!canManageSettings}
                            onClick={() =>
                              updateSetting(
                                "finance",
                                "showPaymentOnChalan",
                                !settings.finance?.showPaymentOnChalan,
                              )
                            }
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative shrink-0",
                              !isAdminOrSuperAdmin && "opacity-60 cursor-not-allowed",
                              settings.finance?.showPaymentOnChalan
                                ? "bg-amber-600"
                                : "bg-slate-200 dark:bg-slate-700",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                settings.finance?.showPaymentOnChalan
                                  ? "right-1"
                                  : "left-1",
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 sm:col-span-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Manage Payment Methods
                        </label>
                        {isAdminOrSuperAdmin && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={newMethod}
                              onChange={(e) => setNewMethod(e.target.value)}
                              placeholder={
                                editingMethod
                                  ? "Edit payment method"
                                  : "Enter new payment method"
                              }
                              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (newMethod.trim()) {
                                    const currentMethods = settings.finance
                                      ?.paymentMethods || [
                                      "Cash",
                                      "Card",
                                      "bKash",
                                      "Nagad",
                                      "Rocket",
                                      "Bank Transfer",
                                      "Mobile Banking",
                                      "Cheque",
                                      "Other",
                                    ];
                                    if (editingMethod) {
                                      // Update existing method
                                      const updatedMethods = currentMethods.map(
                                        (m: string) =>
                                          m === editingMethod
                                            ? newMethod.trim()
                                            : m,
                                      );
                                      updateSetting(
                                        "finance",
                                        "paymentMethods",
                                        updatedMethods,
                                      );

                                      // Also update default payment method if it was the one being edited
                                      if (
                                        settings.finance?.defaultPaymentMethod ===
                                        editingMethod
                                      ) {
                                        updateSetting(
                                          "finance",
                                          "defaultPaymentMethod",
                                          newMethod.trim(),
                                        );
                                      }

                                      setEditingMethod(null);
                                      setNewMethod("");
                                    } else {
                                      // Add new method
                                      if (
                                        !currentMethods.includes(newMethod.trim())
                                      ) {
                                        updateSetting(
                                          "finance",
                                          "paymentMethods",
                                          [...currentMethods, newMethod.trim()],
                                        );
                                        setNewMethod("");
                                      }
                                    }
                                  }
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                              >
                                {editingMethod ? (
                                  <>
                                    <Pencil size={18} /> Update
                                  </>
                                ) : (
                                  <>
                                    <Plus size={18} /> Add
                                  </>
                                )}
                              </button>
                              {editingMethod && (
                                <button
                                  onClick={() => {
                                    setEditingMethod(null);
                                    setNewMethod("");
                                  }}
                                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(
                            settings.finance?.paymentMethods || [
                              "Cash",
                              "Card",
                              "bKash",
                              "Nagad",
                              "Rocket",
                              "Bank Transfer",
                              "Mobile Banking",
                              "Cheque",
                              "Other",
                            ]
                          ).map((method: string) => (
                            <div
                              key={method}
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            >
                              {method}
                              {isAdminOrSuperAdmin && (
                                <div className="flex items-center gap-1 ml-1 border-l border-slate-200 dark:border-slate-700 pl-2">
                                  <button
                                    onClick={() => {
                                      setEditingMethod(method);
                                      setNewMethod(method);
                                    }}
                                    className="text-amber-600 hover:text-amber-700 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const currentMethods = settings.finance
                                        ?.paymentMethods || [
                                        "Cash",
                                        "Card",
                                        "bKash",
                                        "Nagad",
                                        "Rocket",
                                        "Bank Transfer",
                                        "Mobile Banking",
                                        "Cheque",
                                        "Other",
                                      ];
                                      const updatedMethods =
                                        currentMethods.filter(
                                          (m: string) => m !== method,
                                        );
                                      updateSetting(
                                        "finance",
                                        "paymentMethods",
                                        updatedMethods,
                                      );

                                      // Reset default if it was deleted
                                      if (
                                        settings.finance?.defaultPaymentMethod ===
                                        method
                                      ) {
                                        updateSetting(
                                          "finance",
                                          "defaultPaymentMethod",
                                          updatedMethods[0] || "Cash",
                                        );
                                      }
                                    }}
                                    className="text-rose-500 hover:text-rose-700 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "system" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
                      System Configuration
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Low Stock Threshold
                        </label>
                        <div className="relative">
                          <AlertTriangle
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <input
                            type="number"
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.lowStockThreshold}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "lowStockThreshold",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Default Wood Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                          <input
                            type="number"
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.defaultWoodPrice ?? ''}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "defaultWoodPrice",
                                e.target.value === '' ? null : (parseFloat(e.target.value) || null),
                              )
                            }
                            placeholder="Set your own price"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Auto Logout Time (Minutes)
                        </label>
                        <div className="relative">
                          <Clock
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.autoLogoutTime ?? 5}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "autoLogoutTime",
                                parseInt(e.target.value),
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value={1}>1 Minute</option>
                            <option value={5}>5 Minutes</option>
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={30}>30 Minutes</option>
                            <option value={60}>1 Hour</option>
                            <option value={0}>Never</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Language
                        </label>
                        <div className="relative">
                          <Languages
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.language}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "language",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="English">English</option>
                            <option value="Bengali">Bengali</option>
                            <option value="Arabic">Arabic</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Theme Preference
                        </label>
                        <div className="relative">
                          <Palette
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.theme}
                            onChange={(e) =>
                              updateSetting("system", "theme", e.target.value)
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="light">Light Mode</option>
                            <option value="dark">Dark Mode</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Timezone
                        </label>
                        <div className="relative">
                          <Globe
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.timezone || "Asia/Dhaka"}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "timezone",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="Asia/Dhaka">Asia/Dhaka (BST)</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">
                              America/New_York (EST)
                            </option>
                            <option value="Europe/London">
                              Europe/London (GMT)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Date Format
                        </label>
                        <div className="relative">
                          <Calendar
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.dateFormat || "DD/MM/YYYY"}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "dateFormat",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Time Format
                        </label>
                        <div className="relative">
                          <Clock
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            size={18}
                          />
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.system?.timeFormat || "12h"}
                            onChange={(e) =>
                              updateSetting(
                                "system",
                                "timeFormat",
                                e.target.value,
                              )
                            }
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="12h">12-hour (AM/PM)</option>
                            <option value="24h">24-hour</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "integrations" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
                      SMS & Integrations
                    </h3>

                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50 flex gap-3">
                        <AlertTriangle
                          className="text-amber-600 shrink-0"
                          size={20}
                        />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Configure your SMS gateway to send automated alerts
                          and invoice summaries to customers.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          SMS API Key
                        </label>
                        <input
                          type="password"
                          disabled={!isAdminOrSuperAdmin}
                          value={settings.integrations?.smsApiKey}
                          onChange={(e) =>
                            updateSetting(
                              "integrations",
                              "smsApiKey",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. jSBQzIJrqao6pPSien7l"
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Sender ID
                        </label>
                        <input
                          type="text"
                          disabled={!isAdminOrSuperAdmin}
                          value={settings.integrations?.smsSenderId}
                          onChange={(e) =>
                            updateSetting(
                              "integrations",
                              "smsSenderId",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. 8809648907348"
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                          Test Connectivity
                        </h4>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            disabled={!isAdminOrSuperAdmin}
                            value={testNumber}
                            onChange={(e) => setTestNumber(e.target.value)}
                            placeholder="Enter phone number (e.g. 88017...)"
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          />
                          <button
                            onClick={handleTestSms}
                            disabled={!isAdminOrSuperAdmin || isTestingSms}
                            className="px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-white transition-all disabled:opacity-50 w-full sm:w-auto flex items-center justify-center"
                          >
                            {isTestingSms ? "Sending..." : "Send Test SMS"}
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          * Ensure you have configured SMS_API_KEY and
                          SMS_SENDER_ID in the Secrets panel.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "database" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
                      Database Connection
                    </h3>

                    <div
                      className={cn(
                        "p-6 rounded-2xl border flex flex-col items-center text-center gap-4",
                        dbStatus?.success
                          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800"
                          : "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800",
                      )}
                    >
                      <div
                        className={cn(
                          "relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all",
                          dbStatus?.success
                            ? "bg-emerald-500 text-white shadow-emerald-500/20"
                            : "bg-rose-500 text-white shadow-rose-500/20",
                        )}
                      >
                        {isCheckingDb && (
                          <span className="absolute -inset-2 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 dark:border-t-emerald-400 animate-spin" />
                        )}
                        {dbStatus?.success ? (
                          <Shield size={32} />
                        ) : (
                          <AlertTriangle size={32} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                          {dbStatus?.success
                            ? "Supabase Connected"
                            : "Connection Failed"}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                          {dbStatus?.success
                            ? "Your application is successfully connected to the Supabase backend."
                            : dbStatus?.error ||
                              "Could not establish a connection to the database."}
                        </p>
                      </div>
                      <button
                        onClick={handleCheckDb}
                        disabled={isCheckingDb}
                        className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl font-bold hover:shadow-md transition-all disabled:opacity-50"
                      >
                        {isCheckingDb ? "Checking..." : "Re-test Connection"}
                      </button>
                    </div>

                    {!dbStatus?.success &&
                      dbStatus?.error?.includes("Invalid API key") && (
                        <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl space-y-4">
                          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold">
                            <AlertTriangle size={20} />
                            <h4>How to fix &quot;Invalid API key&quot;</h4>
                          </div>
                          <div className="text-sm text-amber-700 dark:text-amber-300 space-y-2">
                            <p>
                              This error typically means the API key you
                              provided in the environment variables is
                              incorrect. Please verify:
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                              <li>
                                You are using the <strong>anon public</strong>{" "}
                                key, not the service_role key.
                              </li>
                              <li>
                                The key starts with <strong>eyJ</strong>.
                              </li>
                              <li>
                                You haven&apos;t accidentally included the
                                Project Ref instead of the Key.
                              </li>
                            </ul>
                            <p className="mt-4 pt-2 border-t border-amber-200/50">
                              Go to your{" "}
                              <strong>
                                Supabase Dashboard &gt; Settings &gt; API
                              </strong>{" "}
                              to find the correct key.
                            </p>
                          </div>
                        </div>
                      )}

                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4">
                        Environment Setup Guide
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        To link your Supabase project, add these variables in
                        the AI Studio **Settings** menu:
                      </p>
                      <div className="space-y-3 font-mono text-[10px] sm:text-xs">
                        <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
                          NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 select-all">
                          NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
                        </div>
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-2xl border border-rose-200 dark:border-rose-800 space-y-4">
                        <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                          <AlertTriangle size={18} />
                          Danger Zone
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div className="p-4 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-rose-200/60 dark:border-rose-800/40 flex flex-col justify-between gap-3">
                            <div>
                              <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Clear All Data</h5>
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                                Permanently clear transactional records (customers, products, invoices, expenses). Settings remain intact.
                              </p>
                            </div>
                            <button
                              onClick={openClearDataModal}
                              disabled={isClearingDb}
                              className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                            >
                              <Trash2 size={15} />
                              {isClearingDb ? "Clearing Data..." : "Clear All Data"}
                            </button>
                          </div>

                          <div className="p-4 bg-white/70 dark:bg-slate-900/70 rounded-xl border border-rose-200/60 dark:border-rose-800/40 flex flex-col justify-between gap-3">
                            <div>
                              <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Delete Account</h5>
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                                Permanently remove your account, profile, business data, and all records from Supabase database.
                              </p>
                            </div>
                            <button
                              onClick={openDeleteAccountModal}
                              className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-400 dark:text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2"
                            >
                              <UserX size={15} />
                              Delete Account
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "printing" && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4">
                      Print Settings
                    </h3>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Default Paper Size
                          </label>
                          <select
                            disabled={!isAdminOrSuperAdmin}
                            value={settings.printing?.paperSize}
                            onChange={(e) =>
                              updateSetting(
                                "printing",
                                "paperSize",
                                e.target.value,
                              )
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            <option value="A4">A4 Standard</option>
                            <option value="A5">A5 Half Size</option>
                            <option value="Thermal">Thermal (80mm)</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between px-4 h-[38.5px] mt-[20px] mb-0 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            Show Watermark
                          </span>
                          <button
                            disabled={!isAdminOrSuperAdmin}
                            onClick={() =>
                              updateSetting(
                                "printing",
                                "showWatermark",
                                !settings.printing?.showWatermark,
                              )
                            }
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              !isAdminOrSuperAdmin && "opacity-60 cursor-not-allowed",
                              settings.printing?.showWatermark
                                ? "bg-amber-600"
                                : "bg-slate-200 dark:bg-slate-700",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                settings.printing?.showWatermark
                                  ? "right-1"
                                  : "left-1",
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Invoice Footer Text
                        </label>
                        <input
                          type="text"
                          disabled={!isAdminOrSuperAdmin}
                          value={settings.printing?.footerText}
                          onChange={(e) =>
                            updateSetting(
                              "printing",
                              "footerText",
                              e.target.value,
                            )
                          }
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </DashboardLayout>

      {isRoleModalOpen && editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingRole.name ? "Edit Role" : "Create Role"}
              </h2>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Trash2 size={20} className="opacity-0" /> {/* Spacer */}
                <span className="absolute right-8 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold p-2 text-xl leading-none">
                  &times;
                </span>
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Role Name
                </label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) =>
                    setEditingRole({ ...editingRole, name: e.target.value })
                  }
                  disabled={editingRole.name === "Super Admin"}
                  placeholder="e.g. Inv Manager"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <input
                  type="text"
                  value={editingRole.description}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      description: e.target.value,
                    })
                  }
                  placeholder="Brief description of this role"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Permissions
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={editingRole.permissions.includes(perm)}
                        disabled={editingRole.name === "Super Admin"}
                        onChange={(e) => {
                          const hasPerm =
                            editingRole.permissions.includes(perm);
                          let newPerms = [...editingRole.permissions];
                          if (hasPerm) {
                            newPerms = newPerms.filter(
                              (p: string) => p !== perm,
                            );
                          } else {
                            newPerms.push(perm);
                          }
                          setEditingRole({
                            ...editingRole,
                            permissions: newPerms,
                          });
                        }}
                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-600"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {perm}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    if (!canAccessRoles) {
                      toast.error("You do not have permission to assign or modify roles.");
                      setIsRoleModalOpen(false);
                      return;
                    }
                    const currentRoles =
                      settings.roles || DEFAULT_SETTINGS.roles;
                    const existingIndex = currentRoles.findIndex(
                      (r: any) => r.id === editingRole.id,
                    );
                    let newRoles = [...currentRoles];

                    if (existingIndex >= 0) {
                      newRoles[existingIndex] = editingRole;
                    } else {
                      newRoles.push({ ...editingRole, id: `r${Date.now()}` });
                    }

                    setSettings((prev: any) => {
                      const updatedSettings = { ...prev, roles: newRoles };
                      supabase.from("app_settings").upsert({
                        id: "global",
                        settings: updatedSettings,
                        updated_at: new Date().toISOString(),
                      }).then(({ error }) => {
                        if (error) console.error("Error saving roles:", error);
                      });
                      return updatedSettings;
                    });
                    setIsRoleModalOpen(false);
                  }}
                  disabled={!editingRole.name}
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all disabled:opacity-50"
                >
                  Save Role
                </button>
                <button
                  onClick={() => setIsRoleModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingUser.id.includes("u") && editingUser.name
                  ? "Edit User"
                  : "Create User"}
              </h2>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Trash2 size={20} className="opacity-0" />
                <span className="absolute right-8 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold p-2 text-xl leading-none">
                  &times;
                </span>
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingUser.name}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, name: e.target.value })
                    }
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    User Name
                  </label>
                  <input
                    type="text"
                    value={editingUser.username || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, username: e.target.value })
                    }
                    placeholder="johndoe123"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    placeholder="john@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editingUser.phone || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, phone: e.target.value })
                    }
                    placeholder="e.g. 017..."
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2 relative">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showEditUserPassword ? "text" : "password"}
                      value={editingUser.password || ""}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, password: e.target.value })
                      }
                      placeholder={editingUser.id.includes("u") && editingUser.name ? "Leave empty to keep unchanged" : "Password"}
                      className="w-full px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showEditUserPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Role
                    </label>
                    {(isEditingSelf || !canAccessRoles) && (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        {isEditingSelf ? "You cannot change your own role" : "Only users with Roles permission can assign or modify roles"}
                      </span>
                    )}
                  </div>
                  <select
                    value={editingUser.roleId}
                    disabled={isEditingSelf || !canAccessRoles}
                    onChange={(e) => {
                      if (isEditingSelf) {
                        toast.error("Users cannot change their own roles.");
                        return;
                      }
                      if (!canAccessRoles) {
                        toast.error("You do not have permission to assign or modify roles.");
                        return;
                      }
                      setEditingUser({ ...editingUser, roleId: e.target.value });
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>
                      Select Role
                    </option>
                    {(settings.roles || DEFAULT_SETTINGS.roles).map(
                      (r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Status
                  </label>
                  <select
                    value={editingUser.status}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, status: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-slate-900 dark:text-slate-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  disabled={
                    !editingUser.name ||
                    !editingUser.roleId
                  }
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all disabled:opacity-50"
                >
                  Done
                </button>
                <button
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isClearDataModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Clear All Data
            </h3>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 border border-rose-200 dark:border-rose-800 rounded-xl text-sm">
                {authError}
              </div>
            )}

            {clearDataAuthStep === "password" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please enter your phone number and admin password to verify
                  this action.
                </p>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={clearDataPhone}
                    onChange={(e) => setClearDataPhone(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    placeholder="Enter admin phone number"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <input
                    type="password"
                    value={clearDataPassword}
                    onChange={(e) => setClearDataPassword(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    placeholder="Enter admin password"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setIsClearDataModalOpen(false)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestClearOTP}
                    disabled={isAuthenticating}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
                  >
                    {isAuthenticating ? "Verifying..." : "Request OTP"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  An OTP has been sent to your phone. Enter it below to confirm
                  deletion.
                </p>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    OTP Code
                  </label>
                  <input
                    type="text"
                    value={clearDataOtp}
                    onChange={(e) => setClearDataOtp(e.target.value)}
                    className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none text-center tracking-[0.5em] text-lg font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    placeholder="------"
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setClearDataAuthStep("password")}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyClearOTP}
                    disabled={isAuthenticating}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
                  >
                    {isAuthenticating ? "Confirming..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isDeleteAccountModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl">
                <UserX size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Delete Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Database Status & Security Verification
                </p>
              </div>
            </div>

            {deleteAccountError && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{deleteAccountError}</span>
              </div>
            )}

            {deleteAccountStep === "credentials" ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Please enter your 11-digit phone number and password to verify ownership before proceeding with permanent account removal.
                </p>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      11-Digit Phone Number
                    </label>
                    <span className={cn("text-[10px] font-mono", deletePhone.length === 11 ? "text-emerald-500 font-bold" : "text-slate-400")}>
                      {deletePhone.length}/11 digits
                    </span>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      maxLength={11}
                      value={deletePhone}
                      onChange={(e) => setDeletePhone(e.target.value.replace(/\D/g, ""))}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm font-medium"
                      placeholder="e.g. 01700000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showDeletePassword ? "text" : "password"}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword(!showDeletePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title={showDeletePassword ? "Hide password" : "Show password"}
                    >
                      {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type={showDeleteConfirmPassword ? "text" : "password"}
                      value={deleteConfirmPassword}
                      onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirmPassword(!showDeleteConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title={showDeleteConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showDeleteConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setIsDeleteAccountModalOpen(false)}
                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestDeleteOTP}
                    disabled={isDeletingAccount || deletePhone.length !== 11}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-md"
                  >
                    {isDeletingAccount ? "Verifying..." : "Send OTP Verification"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs border border-amber-200 dark:border-amber-800/50">
                  An OTP verification code has been sent to <strong>{deletePhone}</strong>. Enter the 6-digit OTP code below to permanently delete your account.
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, ""))}
                    className="w-full py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl outline-none text-center tracking-[0.5em] text-xl font-bold font-mono focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setDeleteAccountStep("credentials")}
                    disabled={isDeletingAccount}
                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-xs transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyDeleteOTPAndExecute}
                    disabled={isDeletingAccount || deleteOtp.length !== 6}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-md"
                  >
                    {isDeletingAccount ? "Deleting Account..." : "Confirm & Permanently Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Delete User?
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-slate-100">{userToDelete.name}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const user = userToDelete;
                    if (user.phone || user.email || user.username) {
                      const phoneQuery = user.phone ? `phone.eq.${user.phone}` : "phone.eq.---";
                      const emailQuery = user.email ? `email.eq.${user.email}` : "email.eq.---";
                      const usernameQuery = user.username ? `username.eq.${user.username}` : "username.eq.---";
                      try {
                        await supabase.from("custom_users").delete().or(`${phoneQuery},${emailQuery},${usernameQuery}`);
                      } catch (e) {
                        console.error("Error deleting from custom_users", e);
                      }
                    }

                    const newUsers = (
                      settings.users || DEFAULT_SETTINGS.users
                    ).filter((u: any) => u.id !== user.id);
                    
                    setSettings((prev: any) => {
                      const updatedSettings = { ...prev, users: newUsers };
                      supabase.from("app_settings").upsert({
                        id: "global",
                        settings: updatedSettings,
                        updated_at: new Date().toISOString(),
                      }).then(({ error }) => {
                        if (error) console.error("Error saving users:", error);
                      });
                      return updatedSettings;
                    });
                    
                    setUserToDelete(null);
                    setAlertConfig({
                      isOpen: true,
                      message: "User deleted successfully",
                      type: "success"
                    });
                  }}
                  className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertPopup
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        message={alertConfig.message}
        type={alertConfig.type}
      />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}
