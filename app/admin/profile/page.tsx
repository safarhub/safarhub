// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import PageLoader from "@/app/components/common/PageLoader";
// import ProfileSidebar from "@/app/components/Pages/profile/ProfileSidebar";

// export default function AdminProfilePage() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(true);
//   const [meta, setMeta] = useState<{ loginCount: number; lastLogin: string | null } | null>(null);
//   const [admin, setAdmin] = useState<{ email: string } | null>(null);
//   const [activeTab, setActiveTab] = useState("profile");
//   const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

//   useEffect(() => {
//     const run = async () => {
//       try {
//         // Verify admin
//         const verifyRes = await fetch("/api/auth/verify", { credentials: "include" });
//         if (!verifyRes.ok) {
//           router.push("/login");
//           return;
//         }
//         const verifyData = await verifyRes.json().catch(() => null);
//         const verifiedUser = verifyData?.user;
//         if (!verifiedUser || verifiedUser.accountType !== "admin") {
//           router.push("/login");
//           return;
//         }
//         setAdmin({ email: verifiedUser.email });

//         // Fetch metrics
//         const res = await fetch("/api/admin/meta", { credentials: "include" });
//         const data = await res.json();
//         if (data.success) {
//           setMeta({
//             loginCount: data.meta.loginCount || 0,
//             lastLogin: data.meta.lastLogin || null,
//           });
//         }
//       } finally {
//         setLoading(false);
//       }
//     };
//     run();
//   }, [router]);

//   // Handle navigation within the profile section
//   const handleNavigation = (section: string) => {
//     // Close mobile sidebar if open
//     setMobileSidebarOpen(false);
    
//     // Set active tab instead of navigating to different pages
//     setActiveTab(section);
//   };

//   // ---------- Logout ----------
//   const handleLogout = async () => {
//     await fetch("/api/logout", { method: "POST" });
//     localStorage.removeItem("user");
//     if (typeof window !== "undefined") {
//       window.dispatchEvent(new CustomEvent("auth:changed", { detail: null }));
//     }
//     window.location.href = "/";
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center bg-gray-50">
//         <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
//       </div>
//     );
//   }

//   if (!admin) return <p className="text-center mt-20">No admin found.</p>;

//   return (
//     <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 text-gray-900">
//       {/* Sidebar */}
//       <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
//         {/* <div className="w-64 h-full bg-white shadow-lg flex flex-col overflow-y-auto overflow-x-hidden">
//           <ProfileSidebar
//             user={{ fullName: "Admin", email: admin.email }}
//             active={activeTab as any}
//             onLogout={handleLogout}
//             onNavigate={handleNavigation}
//           />
//         </div> */}
//       </div>

//       {/* Main Content */}
//       <div className="flex-1 p-4 md:p-10 pt-20 overflow-y-auto">
//         {/* Mobile toggle button for sidebar */}
//         <div className="md:hidden mb-4">
//           {/* <button
//             onClick={() => setMobileSidebarOpen(true)}
//             className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow border text-gray-800"
//           >
//             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
//               <path
//                 fillRule="evenodd"
//                 d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
//                 clipRule="evenodd"
//               />
//             </svg>
//             <span className="text-sm font-medium">Menu</span>
//           </button> */}
//         </div>

//         {/* Profile Tab Content */}
//         {activeTab === "profile" && (
//           <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
//             <h1 className="text-2xl font-semibold mb-1">Admin Profile</h1>
//             <p className="text-gray-600 mb-6">Account overview and login activity</p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div className="rounded-xl border p-5">
//                 <div className="text-sm text-gray-500">Email</div>
//                 <div className="text-lg font-medium">{admin?.email}</div>
//               </div>
//               <div className="rounded-xl border p-5">
//                 <div className="text-sm text-gray-500">Login Count</div>
//                 <div className="text-2xl font-bold">{meta?.loginCount ?? 0}</div>
//               </div>
//               <div className="rounded-xl border p-5 md:col-span-2">
//                 <div className="text-sm text-gray-500">Last Login</div>
//                 <div className="text-lg font-medium">
//                   {meta?.lastLogin
//                     ? new Date(meta.lastLogin).toLocaleString()
//                     : "No data yet"}
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Other tabs would be loaded here dynamically */}
//         {activeTab !== "profile" && (
//           <div className="max-w-4xl mx-auto">
//             {/* This is where other content would be loaded dynamically */}
//             <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
//               <h2 className="text-xl font-semibold text-gray-800 mb-2">
//                 {activeTab === "bookings" && "Booking Management"}
//                 {activeTab === "wishlist" && "Wishlist"}
//                 {activeTab === "inbox" && "Inbox"}
//                 {activeTab === "support" && "Support"}
//               </h2>
//               <p className="text-gray-500">
//                 {activeTab === "bookings" && "Manage all bookings here."}
//                 {activeTab === "wishlist" && "View wishlist items."}
//                 {activeTab === "inbox" && "Check your inbox messages."}
//                 {activeTab === "support" && "Access support resources."}
//               </p>
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Mobile Sidebar Drawer */}
//       {mobileSidebarOpen && (
//         <>
//           <div
//             className="fixed inset-0 z-90 bg-black/40 md:hidden"
//             onClick={() => setMobileSidebarOpen(false)}
//           />
//           <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-100 p-6 md:hidden overflow-y-auto">
//             <div className="mb-6 flex items-center justify-between">
//               <span className="text-lg font-semibold text-gray-800">Menu</span>
//               <button
//                 onClick={() => setMobileSidebarOpen(false)}
//                 className="px-3 py-1.5 rounded-md border text-gray-700"
//               >
//                 Close
//               </button>
//             </div>

//             <div className="mb-8 flex flex-col items-center space-y-2">
//               <div className="w-14 h-14 rounded-full border-4 border-green-200 flex items-center justify-center text-white font-bold bg-gradient-to-br from-indigo-500 to-purple-600">
//                 A
//               </div>
//               <h2 className="text-base font-bold text-center text-gray-800 truncate">
//                 Admin
//               </h2>
//               <p className="text-xs text-gray-500 text-center truncate">{admin?.email}</p>
//             </div>

//             <nav className="space-y-2">
//               {[
//                 { id: "profile", label: "My Profile", icon: "M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" },
//                 { id: "bookings", label: "Bookings", icon: "M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" },
//                 { id: "wishlist", label: "Wishlist", icon: "M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" },
//                 { id: "inbox", label: "Inbox", icon: "M2.94 6.412A2 2 0 002 8.108V16a2 2 0 002 2h12a2 2 0 002-2V8.108a2 2 0 00-.94-1.696l-6-3.75a2 2 0 00-2.12 0l-6 3.75zm2.615 2.423a1 1 0 10-1.11 1.664l5 3.333a1 1 0 001.11 0l5-3.333a1 1 0 00-1.11-1.664L10 11.798 5.555 8.835z" },
//                 { id: "support", label: "Support", icon: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" }
//               ].map((item) => (
//                 <button
//                   key={item.id}
//                   onClick={() => {
//                     handleNavigation(item.id);
//                   }}
//                   className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${
//                     activeTab === item.id
//                       ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg"
//                       : "text-gray-700 hover:bg-green-50 hover:text-green-600"
//                   }`}
//                 >
//                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
//                     <path
//                       fillRule="evenodd"
//                       d={item.icon}
//                       clipRule="evenodd"
//                     />
//                   </svg>
//                   {item.label}
//                 </button>
//               ))}

//               <div className="pt-4 border-t border-gray-100">
//                 <button
//                   onClick={handleLogout}
//                   className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl font-medium shadow-lg transition-all duration-200 flex items-center gap-3"
//                 >
//                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
//                     <path
//                       fillRule="evenodd"
//                       d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
//                       clipRule="evenodd"
//                     />
//                   </svg>
//                   Logout
//                 </button>
//               </div>
//             </nav>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileSidebar from "@/app/components/Pages/profile/ProfileSidebar";

export default function AdminProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ loginCount: number; lastLogin: string | null } | null>(null);
  const [admin, setAdmin] = useState<{ email: string } | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ---- Change Password Modal State ----
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwStep, setPwStep] = useState<"form" | "otp" | "success">("form");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const verifyRes = await fetch("/api/auth/verify", { credentials: "include" });
        if (!verifyRes.ok) { router.push("/login"); return; }
        const verifyData = await verifyRes.json().catch(() => null);
        const verifiedUser = verifyData?.user;
        if (!verifiedUser || verifiedUser.accountType !== "admin") {
          router.push("/login"); return;
        }
        setAdmin({ email: verifiedUser.email });

        const res = await fetch("/api/admin/meta", { credentials: "include" });
        const data = await res.json();
        if (data.success) {
          setMeta({
            loginCount: data.meta.loginCount || 0,
            lastLogin: data.meta.lastLogin || null,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  const handleNavigation = (section: string) => {
    setMobileSidebarOpen(false);
    setActiveTab(section);
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    localStorage.removeItem("user");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:changed", { detail: null }));
    }
    window.location.href = "/";
  };

  // ---- Open / close modal ----
  const openPasswordModal = () => {
    setShowPasswordModal(true);
    setPwStep("form");
    setNewPassword("");
    setConfirmPassword("");
    setOtp("");
    setPwError("");
    setOtpSent(false);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPwStep("form");
    setNewPassword("");
    setConfirmPassword("");
    setOtp("");
    setPwError("");
  };

  // ---- Step 1: Validate passwords and send OTP ----
  const handleSendOtp = async () => {
    setPwError("");

    if (!newPassword || newPassword.length < 8) {
      setPwError("Password must be at least 8 characters."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match."); return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/admin/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwError(data.message || "Failed to send OTP. Try again."); return;
      }
      setOtpSent(true);
      setPwStep("otp");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  // ---- Step 2: Verify OTP and change password ----
  const handleChangePassword = async () => {
    setPwError("");

    if (!otp || otp.length !== 6) {
      setPwError("Please enter the 6-digit OTP."); return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPwError(data.message || "Invalid or expired OTP."); return;
      }
      setPwStep("success");
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) return <p className="text-center mt-20">No admin found.</p>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen" />

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-10 pt-20 overflow-y-auto">
        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-semibold">Admin Profile</h1>
              {/* ---- CHANGE PASSWORD BUTTON ---- */}
              <button
                onClick={openPasswordModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Change Password
              </button>
            </div>
            <p className="text-gray-600 mb-6">Account overview and login activity</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-xl border p-5">
                <div className="text-sm text-gray-500">Email</div>
                <div className="text-lg font-medium">{admin?.email}</div>
              </div>
              <div className="rounded-xl border p-5">
                <div className="text-sm text-gray-500">Login Count</div>
                <div className="text-2xl font-bold">{meta?.loginCount ?? 0}</div>
              </div>
              <div className="rounded-xl border p-5 md:col-span-2">
                <div className="text-sm text-gray-500">Last Login</div>
                <div className="text-lg font-medium">
                  {meta?.lastLogin
                    ? new Date(meta.lastLogin).toLocaleString()
                    : "No data yet"}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab !== "profile" && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                {activeTab === "bookings" && "Booking Management"}
                {activeTab === "wishlist" && "Wishlist"}
                {activeTab === "inbox" && "Inbox"}
                {activeTab === "support" && "Support"}
              </h2>
              <p className="text-gray-500">
                {activeTab === "bookings" && "Manage all bookings here."}
                {activeTab === "wishlist" && "View wishlist items."}
                {activeTab === "inbox" && "Check your inbox messages."}
                {activeTab === "support" && "Access support resources."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <>
          <div className="fixed inset-0 z-90 bg-black/40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-100 p-6 md:hidden overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-800">Menu</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="px-3 py-1.5 rounded-md border text-gray-700">Close</button>
            </div>
            <div className="mb-8 flex flex-col items-center space-y-2">
              <div className="w-14 h-14 rounded-full border-4 border-green-200 flex items-center justify-center text-white font-bold bg-gradient-to-br from-indigo-500 to-purple-600">A</div>
              <h2 className="text-base font-bold text-center text-gray-800 truncate">Admin</h2>
              <p className="text-xs text-gray-500 text-center truncate">{admin?.email}</p>
            </div>
            <nav className="space-y-2">
              {[
                { id: "profile", label: "My Profile", icon: "M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" },
                { id: "bookings", label: "Bookings", icon: "M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" },
                { id: "wishlist", label: "Wishlist", icon: "M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" },
                { id: "inbox", label: "Inbox", icon: "M2.94 6.412A2 2 0 002 8.108V16a2 2 0 002 2h12a2 2 0 002-2V8.108a2 2 0 00-.94-1.696l-6-3.75a2 2 0 00-2.12 0l-6 3.75zm2.615 2.423a1 1 0 10-1.11 1.664l5 3.333a1 1 0 001.11 0l5-3.333a1 1 0 00-1.11-1.664L10 11.798 5.555 8.835z" },
                { id: "support", label: "Support", icon: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" }
              ].map((item) => (
                <button key={item.id} onClick={() => handleNavigation(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 ${activeTab === item.id ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg" : "text-gray-700 hover:bg-green-50 hover:text-green-600"}`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d={item.icon} clipRule="evenodd" />
                  </svg>
                  {item.label}
                </button>
              ))}
              <div className="pt-4 border-t border-gray-100">
                <button onClick={handleLogout}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl font-medium shadow-lg transition-all duration-200 flex items-center gap-3">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Logout
                </button>
              </div>
            </nav>
          </div>
        </>
      )}

      {/* ===================== CHANGE PASSWORD MODAL ===================== */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">

            {/* Close button */}
            <button
              onClick={closePasswordModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* ---- STEP 1: Enter new password ---- */}
            {pwStep === "form" && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
                    <p className="text-xs text-gray-500">An OTP will be sent to <span className="font-medium text-indigo-600">Safarhub1@gmail.com</span></p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNew
                          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm
                          ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    </div>
                  </div>

                  {pwError && <p className="text-sm text-red-500">{pwError}</p>}

                  <button
                    onClick={handleSendOtp}
                    disabled={pwLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {pwLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                    {pwLoading ? "Sending OTP..." : "Send OTP to Email"}
                  </button>
                </div>
              </>
            )}

            {/* ---- STEP 2: Enter OTP ---- */}
            {pwStep === "otp" && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Enter OTP</h2>
                    <p className="text-xs text-gray-500">Check <span className="font-medium text-green-600">Safarhub1@gmail.com</span> for your 6-digit code</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="• • • • • •"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 text-center">OTP expires in 10 minutes</p>
                  </div>

                  {pwError && <p className="text-sm text-red-500 text-center">{pwError}</p>}

                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {pwLoading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : null}
                    {pwLoading ? "Verifying..." : "Verify & Change Password"}
                  </button>

                  <button
                    onClick={() => { setPwStep("form"); setPwError(""); }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}

            {/* ---- STEP 3: Success ---- */}
            {pwStep === "success" && (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Password Changed!</h2>
                <p className="text-sm text-gray-500 mb-6">Your password has been updated successfully.</p>
                <button
                  onClick={closePasswordModal}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            )}

          </div>
        </div>
      )}
      {/* ===================== END MODAL ===================== */}

    </div>
  );
}