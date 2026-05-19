"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AccountType {
  _id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'INVESTMENT';
  balance: number;
}

interface TransactionType {
  _id: string;
  accountId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  description: string;
  date: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);

  // Modals state
  const [showAccModal, setShowAccModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Forms state
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("BANK");
  const [accBalance, setAccBalance] = useState("");
  
  const [txAccount, setTxAccount] = useState("");
  const [txType, setTxType] = useState("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Makanan");
  const [txDesc, setTxDesc] = useState("");

  // Edit Balance state
  const [selectedAccId, setSelectedAccId] = useState("");
  const [selectedAccName, setSelectedAccName] = useState("");
  const [newBalanceValue, setNewBalanceValue] = useState("");

  // Limit Budget state
  const [newLimitValue, setNewLimitValue] = useState("");

  // PWA & Hamburger Menu states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPwaGuideModal, setShowPwaGuideModal] = useState(false);

  const fetchData = async () => {
    try {
      const resAcc = await fetch("/api/accounts");
      const dataAcc = await resAcc.json();
      if (Array.isArray(dataAcc)) {
        setAccounts(dataAcc);
        if (dataAcc.length > 0 && !txAccount) setTxAccount(dataAcc[0]._id);
      }

      const resTx = await fetch("/api/transactions");
      const dataTx = await resTx.json();
      if (Array.isArray(dataTx)) setTransactions(dataTx);

      // KODE LOGIKA PENYANGGA UNTUK LIMIT ANGGARAN
      const resLimit = await fetch("/api/user/limit");
      const dataLimit = await resLimit.json();
      
      console.log("Data Limit dari API:", dataLimit);

      if (dataLimit && typeof dataLimit.monthlyLimit === "number") {
        setMonthlyLimit(dataLimit.monthlyLimit);
        setNewLimitValue(dataLimit.monthlyLimit.toString());
      } else if (dataLimit && dataLimit.monthlyLimit !== undefined) {
        setMonthlyLimit(Number(dataLimit.monthlyLimit));
        setNewLimitValue(dataLimit.monthlyLimit.toString());
      }
    } catch (e) {
      console.error("Gagal sinkronisasi data keuangan", e);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  useEffect(() => {
    // Cek jika aplikasi berjalan dalam mode standalone PWA
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    setIsStandalone(!!checkStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      setShowPwaGuideModal(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted PWA installation");
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsStandalone(true);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accName, type: accType, balance: Number(accBalance) })
    });
    if (res.ok) {
      setShowAccModal(false);
      setAccName("");
      setAccBalance("");
      fetchData();
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: txAccount,
        type: txType,
        amount: Number(txAmount),
        category: txCategory,
        description: txDesc
      })
    });
    if (res.ok) {
      setShowTxModal(false);
      setTxAmount("");
      setTxDesc("");
      fetchData();
    }
  };

  const handleUpdateBalanceDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/accounts/${selectedAccId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: Number(newBalanceValue) })
    });
    if (res.ok) {
      setShowEditBalanceModal(false);
      setNewBalanceValue("");
      fetchData();
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/user/limit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyLimit: Number(newLimitValue) })
    });
    
    if (res.ok) {
      setShowLimitModal(false);
      await fetchData(); // Memanggil ulang fungsi fetch agar tampilan layar langsung ter-update
    } else {
      alert("Gagal memperbarui batas anggaran.");
    }
  };

  if (status === "loading") return <div className="grid place-items-center h-screen bg-gray-50 text-gray-500 text-sm">Menyelaraskan dompet digital...</div>;

  const totalNetWorth = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // LOGIKA HITUNG PENGELUARAN BULAN INI
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const totalMonthlyExpense = transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      return tx.type === "EXPENSE" && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    })
    .reduce((acc, curr) => acc + curr.amount, 0);

  // Hitung persentase pemakaian limit budget bulanan
  const limitPercentage = monthlyLimit > 0 ? Math.min((totalMonthlyExpense / monthlyLimit) * 100, 100) : 0;

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === "ALL") return true;
    const targetAccount = accounts.find(a => a._id === tx.accountId);
    return targetAccount?.type === filterType;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800 antialiased">
      
      {/* HEADER */}
      <div className="max-w-6xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 relative">
        <div>
          <p className="text-xs text-gray-400 font-medium">Selamat Datang,</p>
          <h2 className="text-lg font-bold text-gray-900">{session?.user?.name}</h2>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            className="p-2.5 bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 rounded-xl transition-all border border-gray-100 hover:border-green-200 cursor-pointer flex items-center justify-center"
            title="Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              {showMenu ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>

          {/* DROPDOWN MENU */}
          {showMenu && (
            <>
              {/* Back-drop to close menu when clicking outside */}
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-20 animate-in fade-in slide-in-from-top-3 duration-200">
                {/* User Info */}
                <div className="px-4 py-2 border-b border-gray-50">
                  <p className="text-[10px] text-gray-400 font-medium">Masuk Sebagai</p>
                  <p className="text-xs font-bold text-gray-900 truncate">{session?.user?.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{session?.user?.email}</p>
                </div>

                {/* Menu Options */}
                <div className="p-2 space-y-1">
                  
                  {/* PWA Button */}
                  {isStandalone ? (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 text-green-600 font-bold rounded-xl text-xs bg-green-50">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-green-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Aplikasi PWA Aktif</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        handleInstallPWA();
                      }} 
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-gray-700 hover:text-green-700 hover:bg-green-50 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 group-hover:text-green-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>Download Versi PWA</span>
                    </button>
                  )}

                  {/* Keluar Button */}
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      signOut();
                    }} 
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl text-xs font-bold transition-all cursor-pointer text-left"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    <span>Keluar</span>
                  </button>

                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* AREA KIRI: CARD UTAMA, LIMIT TRACKER & DAFTAR ASET */}
        <div className="md:col-span-2 space-y-6">
          
          {/* CARD TOTAL KEKAYAAN */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-3xl text-white shadow-lg shadow-green-100">
            <p className="text-sm opacity-80 font-medium">Total Aset Gabungan</p>
            <h1 className="text-3xl md:text-4xl font-black mt-1">Rp {totalNetWorth.toLocaleString("id-ID")}</h1>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { if(accounts.length > 0) setShowTxModal(true); else alert("Tambahkan rekening bank terlebih dahulu!"); }} className="flex-1 bg-white text-green-700 font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-green-50 transition-all shadow-sm cursor-pointer">
                Catat Transaksi
              </button>
              <button onClick={() => setShowAccModal(true)} className="bg-green-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-green-400 transition-all border border-green-400 cursor-pointer">
                Tambah Bank
              </button>
            </div>
          </div>

          {/* FITUR LIMIT BUDGET BULANAN */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Limit Anggaran Bulanan</h3>
                <p className="text-xs text-gray-400 mt-0.5">Kontrol akumulasi pengeluaran harianmu</p>
              </div>
              <button 
                onClick={() => setShowLimitModal(true)}
                className="text-[11px] text-green-600 font-bold hover:underline cursor-pointer bg-green-50 py-1.5 px-3 rounded-lg"
              >
                Set Limit
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end text-xs font-semibold">
                <span className="text-gray-500">
                  Terpakai: <span className="text-gray-900 font-bold">Rp {totalMonthlyExpense.toLocaleString("id-ID")}</span>
                </span>
                <span className="text-gray-400">
                  Batas: {monthlyLimit > 0 ? `Rp ${monthlyLimit.toLocaleString("id-ID")}` : "Belum ditentukan"}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${limitPercentage}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    limitPercentage >= 90 ? "bg-red-500" : limitPercentage >= 75 ? "bg-amber-500" : "bg-green-600"
                  }`}
                />
              </div>

              {monthlyLimit > 0 && limitPercentage >= 90 && (
                <p className="text-[10px] text-red-500 font-bold tracking-wide animate-pulse mt-1">
                  Peringatan: Pengeluaran bulan ini sudah mencapai {limitPercentage.toFixed(0)}% dari batas limit anggaran!
                </p>
              )}
            </div>
          </div>

          {/* LIST DOMPET / BANK */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Dompet & Rekening Berjalan ({accounts.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map((acc) => (
                <div key={acc._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-green-200 transition-all">
                  <div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${
                      acc.type === "BANK" ? "bg-blue-50 text-blue-600" :
                      acc.type === "INVESTMENT" ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {acc.type}
                    </span>
                    <h4 className="font-bold text-gray-900 mt-1 text-sm">{acc.name}</h4>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="font-extrabold text-sm text-gray-900">Rp {acc.balance.toLocaleString("id-ID")}</p>
                    <button 
                      onClick={() => {
                        setSelectedAccId(acc._id);
                        setSelectedAccName(acc.name);
                        setNewBalanceValue(acc.balance.toString());
                        setShowEditBalanceModal(true);
                      }}
                      className="text-gray-400 hover:text-green-600 p-1.5 rounded-md hover:bg-gray-50 transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-gray-100"
                      title="Sesuaikan/Update Saldo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AREA KANAN: BADGE FILTER & HISTORY MUTASI */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-[580px]">
          <h3 className="font-bold text-gray-900 mb-2 text-sm">Riwayat Transaksi</h3>
          
          {/* BADGES */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {["ALL", "BANK", "CASH", "INVESTMENT"].map((b) => (
              <button 
                key={b} 
                onClick={() => setFilterType(b)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                  filterType === b ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                } cursor-pointer`}
              >
                {b === "ALL" ? "Semua" : b}
              </button>
            ))}
          </div>

          {/* SCROLLABLE LIST MUTASI */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredTransactions.map((tx) => {
              const linkedAccount = accounts.find(a => a._id === tx.accountId);
              return (
                <div key={tx._id} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 hover:bg-gray-50/50 rounded p-1 transition-all">
                  <div>
                    <h5 className="font-bold text-gray-900">{tx.category} <span className="text-[10px] font-normal text-gray-400">({linkedAccount ? linkedAccount.name : 'Aset'})</span></h5>
                    <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{tx.description || "-"}</p>
                  </div>
                  <p className={`font-bold ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                    {tx.type === "INCOME" ? "+" : "-"} Rp {tx.amount.toLocaleString("id-ID")}
                  </p>
                </div>
              );
            })}
            {filteredTransactions.length === 0 && <p className="text-center text-xs text-gray-400 italic pt-16">Tidak ditemukan catatan keuangan.</p>}
          </div>
        </div>
      </div>

      {/* MODAL: CONFIG ANGGARAN LIMIT BULANAN */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-2">Atur Batas Anggaran</h3>
            <p className="text-xs text-gray-400 mb-4">Tentukan batas pengeluaran bulanan maksimal akun Anda.</p>
            <form onSubmit={handleUpdateLimit} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Batas Pengeluaran Bulanan (Rp)</label>
                <input required type="number" placeholder="Masukkan batas nominal" value={newLimitValue} onChange={e => setNewLimitValue(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowLimitModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Simpan Batas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH BANK */}
      {showAccModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-4">Tambah Akun Dana Baru</h3>
            <form onSubmit={handleAddAccount} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nama Sumber Dana</label>
                <input required type="text" placeholder="Contoh: BCA, Dompet Fisik, Stockbit" value={accName} onChange={e => setAccName(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Tipe Akun</label>
                <select value={accType} onChange={e => setAccType(e.target.value)} className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500">
                  <option value="BANK">BANK / REKENING</option>
                  <option value="CASH">UANG CASH / TUNAI</option>
                  <option value="INVESTMENT">SAHAM / INVESTASI</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Saldo Awal</label>
                <input required type="number" placeholder="0" value={accBalance} onChange={e => setAccBalance(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAccModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold cursor-pointer">Simpan Akun</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT/UPDATE SALDO MANUAL */}
      {showEditBalanceModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-1">Update Saldo Instan</h3>
            <p className="text-xs text-gray-400 mb-4">Kalibrasi nominal saldo untuk akun: <span className="font-bold text-gray-700">{selectedAccName}</span></p>
            <form onSubmit={handleUpdateBalanceDirectly} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal Saldo Terbaru (Rp)</label>
                <input required type="number" value={newBalanceValue} onChange={e => setNewBalanceValue(e.target.value)} className="w-full border p-2 rounded-lg text-sm font-bold text-green-600 focus:outline-none focus:border-green-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditBalanceModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold cursor-pointer">Perbarui Saldo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REKAM TRANSAKSI */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-4">Catat Keuangan</h3>
            <form onSubmit={handleAddTransaction} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Pilih Rekening Tujuan</label>
                <select value={txAccount} onChange={e => setTxAccount(e.target.value)} className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500">
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Jenis Aktivitas</label>
                <select value={txType} onChange={e => setTxType(e.target.value)} className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500">
                  <option value="EXPENSE">PENGELUARAN (-)</option>
                  <option value="INCOME">PEMASUKAN (+)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal (Rp)</label>
                <input required type="number" placeholder="0" value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Kategori</label>
                <input required type="text" placeholder="Contoh: Dividen BBRI, Bensin, Makan Siang" value={txCategory} onChange={e => setTxCategory(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Keterangan</label>
                <input type="text" placeholder="Opsional" value={txDesc} onChange={e => setTxDesc(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowTxModal(false)} className="flex-1 bg-gray-100 py-2 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold cursor-pointer">Rekam Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PETUNJUK INSTALASI PWA */}
      {showPwaGuideModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl text-xs space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Cara Memasang frugalin.aja</h3>
                <p className="text-gray-400 mt-0.5 text-[10px]">Akses cepat aplikasi di HP atau laptop tanpa browser</p>
              </div>
              <button onClick={() => setShowPwaGuideModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 mt-2">
              {/* iOS / Safari */}
              <div className="p-3 bg-green-50/50 rounded-xl border border-green-100">
                <h4 className="font-bold text-green-700 text-xs flex items-center gap-1.5 mb-1.5">
                  🍎 Untuk Pengguna iOS (Safari)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px]">
                  <li>Buka halaman ini menggunakan browser <b>Safari</b>.</li>
                  <li>Ketuk tombol <b>Bagikan (Share)</b> di menu bar bawah browser.</li>
                  <li>Gulir ke bawah lalu ketuk <b>Tambah ke Layar Utama (Add to Home Screen)</b>.</li>
                  <li>Beri nama <b>frugalin.aja</b> lalu tekan <b>Tambah (Add)</b>.</li>
                </ol>
              </div>

              {/* Android / Chrome */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-700 text-xs flex items-center gap-1.5 mb-1.5">
                  🤖 Untuk Pengguna Android / Laptop (Chrome)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px]">
                  <li>Ketuk ikon <b>tiga titik</b> di pojok kanan atas browser Chrome.</li>
                  <li>Ketuk opsi <b>Instal Aplikasi</b> atau <b>Tambahkan ke Layar Utama</b>.</li>
                  <li>Konfirmasi instalasi untuk memasangnya di perangkat Anda.</li>
                </ol>
              </div>
            </div>

            <button onClick={() => setShowPwaGuideModal(false)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl cursor-pointer text-center text-xs mt-2 transition-all">
              Mengerti, Saya Siap Pasang
            </button>
          </div>
        </div>
      )}

    </div>
  );
}