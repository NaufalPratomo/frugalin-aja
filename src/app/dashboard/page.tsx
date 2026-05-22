"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "../../components/Toast";

interface AccountType {
  _id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'INVESTMENT';
  balance: number;
  monthlyInterest?: number;
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

function parseReceiptText(text: string) {
  const lines = text.split("\n");
  
  let detectedAmount = 0;
  let detectedCategory = "Belanja & Harian";
  let detectedDescription = "";
  let detectedDate = "";
  
  const nonEmptyLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  if (nonEmptyLines.length > 0) {
    const storeCandidate = nonEmptyLines[0];
    if (!/receipt|invoice|struk|nota/i.test(storeCandidate)) {
      detectedDescription = storeCandidate;
    } else if (nonEmptyLines.length > 1) {
      detectedDescription = nonEmptyLines[1];
    }
  }
  
  const totalKeywords = [
    /grand\s*total/i,
    /total/i,
    /jumlah\s*total/i,
    /jumlah/i,
    /total\s*bayar/i,
    /bayar/i,
    /rp\.?\s*\d+/i,
    /amount/i,
    /netto/i,
    /subtotal/i,
  ];

  let amountCandidates: { line: string; value: number; priority: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (let k = 0; k < totalKeywords.length; k++) {
      const regex = totalKeywords[k];
      if (regex.test(line)) {
        const numbers = line.match(/\d+[\d.,]*/g);
        if (numbers) {
          for (const numStr of numbers) {
            let cleanStr = numStr.replace(/[,.]00$/, "");
            const digitsOnly = cleanStr.replace(/\D/g, "");
            const val = parseInt(digitsOnly, 10);
            if (val > 100 && val < 50000000) {
              amountCandidates.push({
                line: line,
                value: val,
                priority: k
              });
            }
          }
        }
      }
    }
  }

  if (amountCandidates.length > 0) {
    amountCandidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.value - a.value;
    });
    detectedAmount = amountCandidates[0].value;
  } else {
    const allNumbers = text.match(/\b\d+[,.]\d{3}\b|\b\d{4,7}\b/g);
    if (allNumbers) {
      let maxVal = 0;
      for (const numStr of allNumbers) {
        const digitsOnly = numStr.replace(/\D/g, "");
        const val = parseInt(digitsOnly, 10);
        if (val > maxVal && val < 10000000) {
          maxVal = val;
        }
      }
      detectedAmount = maxVal;
    }
  }

  const categoryRules = [
    {
      category: "Makanan & Minuman",
      keywords: [/makan/i, /minum/i, /kopi/i, /cafe/i, /resto/i, /bakso/i, /mie/i, /warung/i, /food/i, /beverage/i, /coffe/i, /teh/i, /chicken/i, /burger/i, /pizza/i, /kuliner/i, /dapur/i, /roti/i, /bakery/i]
    },
    {
      category: "Belanja & Harian",
      keywords: [/mart/i, /indo/i, /alfa/i, /super/i, /pasar/i, /hiper/i, /shop/i, /store/i, /sabun/i, /odol/i, /detergen/i, /susu/i, /sembako/i, /minyak/i, /beras/i, /trans/i, /carefour/i, /lotte/i, /baju/i, /celana/i, /sepatu/i, /fashion/i, /mall/i]
    },
    {
      category: "Transportasi",
      keywords: [/bensin/i, /pertamina/i, /spbu/i, /shell/i, /gojek/i, /grab/i, /uber/i, /ojek/i, /taxi/i, /taksi/i, /tol/i, /parkir/i, /tiket/i, /kereta/i, /pesawat/i, /travel/i, /krl/i, /mrt/i]
    },
    {
      category: "Kesehatan",
      keywords: [/apotek/i, /obat/i, /dokter/i, /klinik/i, /sehat/i, /rs/i, /rumah\s*sakit/i, /vitamin/i, /periksa/i, /optik/i, /kacamata/i]
    },
    {
      category: "Hiburan & Rekreasi",
      keywords: [/nonton/i, /bioskop/i, /cinema/i, /xxi/i, /cgv/i, /game/i, /play/i, /wisata/i, /liburan/i, /hotel/i, /karaoke/i, /konser/i, /tiket/i]
    },
    {
      category: "Tagihan & Pulsa",
      keywords: [/listrik/i, /pln/i, /air/i, /pdam/i, /internet/i, /wifi/i, /pulsa/i, /kuota/i, /telkom/i, /bpjs/i, /asuransi/i, /pajak/i, /iuran/i]
    }
  ];

  for (const rule of categoryRules) {
    for (const kw of rule.keywords) {
      if (kw.test(text)) {
        detectedCategory = rule.category;
        break;
      }
    }
    if (detectedCategory !== "Belanja & Harian") break;
  }

  const dateRegexes = [
    /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/,
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/
  ];

  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match) {
      if (match[1].length === 4) {
        detectedDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        let year = match[3];
        if (year.length === 2) year = "20" + year;
        detectedDate = `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
      break;
    }
  }

  if (!detectedDate) {
    const today = new Date();
    detectedDate = today.toISOString().split("T")[0];
  }

  if (detectedDescription) {
    detectedDescription = detectedDescription
      .toLowerCase()
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.substring(1))
      .join(" ");
  } else {
    detectedDescription = "Belanja Struk";
  }

  return {
    amount: detectedAmount,
    category: detectedCategory,
    description: detectedDescription,
    date: detectedDate
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);

  // Modals state
  const [showAccModal, setShowAccModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // OCR Scan states
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrImageSrc, setOcrImageSrc] = useState<string | null>(null);

  const [ocrAmount, setOcrAmount] = useState("");
  const [ocrCategory, setOcrCategory] = useState("Belanja & Harian");
  const [ocrDesc, setOcrDesc] = useState("");
  const [ocrDate, setOcrDate] = useState("");
  const [ocrAccount, setOcrAccount] = useState("");

  // Forms state
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState("BANK");
  const [accBalance, setAccBalance] = useState("");
  const [accInterest, setAccInterest] = useState("");
  
  const [txAccount, setTxAccount] = useState("");
  const [txType, setTxType] = useState("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("Makanan");
  const [txDesc, setTxDesc] = useState("");

  // Edit Balance state
  const [selectedAccId, setSelectedAccId] = useState("");
  const [selectedAccName, setSelectedAccName] = useState("");
  const [selectedAccType, setSelectedAccType] = useState("");
  const [newBalanceValue, setNewBalanceValue] = useState("");
  const [newInterestValue, setNewInterestValue] = useState("");

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
        if (dataAcc.length > 0) {
          if (!txAccount) setTxAccount(dataAcc[0]._id);
          if (!ocrAccount) setOcrAccount(dataAcc[0]._id);
        }
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
      showToast("Gagal menyelaraskan data keuangan dari server.", "error");
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
    showToast("Sedang membuat rekening baru...", "info");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: accName,
          type: accType,
          balance: Number(accBalance),
          monthlyInterest: accType === "BANK" ? Number(accInterest) : 0
        })
      });
      if (res.ok) {
        showToast(`Rekening "${accName}" berhasil dibuat!`, "success");
        setShowAccModal(false);
        setAccName("");
        setAccBalance("");
        setAccInterest("");
        fetchData();
      } else {
        showToast("Gagal membuat rekening baru.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghubungkan ke server.", "error");
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Mencatat transaksi keuangan...", "info");
    try {
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
        showToast("Transaksi keuangan berhasil dicatat!", "success");
        setShowTxModal(false);
        setTxAmount("");
        setTxDesc("");
        fetchData();
      } else {
        showToast("Gagal mencatat transaksi.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat mencatat transaksi.", "error");
    }
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create image preview
    const reader = new FileReader();
    reader.onload = () => {
      setOcrImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);
    setScanProgress(0);
    showToast("Memulai proses OCR pemindaian struk...", "info");

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            setScanProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      console.log("Raw OCR Text:", text);

      // Parse text to extract transaction data
      const parsed = parseReceiptText(text);

      // Update forms state with detected data
      setOcrAmount(parsed.amount > 0 ? parsed.amount.toString() : "");
      setOcrCategory(parsed.category);
      setOcrDesc(parsed.description);
      setOcrDate(parsed.date);
      
      showToast("Pemindaian selesai! Silakan periksa hasilnya.", "success");
    } catch (err: any) {
      console.error("OCR Scan Error:", err);
      showToast("Gagal melakukan scan ocr. Masukkan data manual.", "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddOcrTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrAccount) {
      showToast("Pilih rekening bank terlebih dahulu!", "error");
      return;
    }
    showToast("Mencatat transaksi hasil OCR...", "info");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: ocrAccount,
          type: "EXPENSE",
          amount: Number(ocrAmount),
          category: ocrCategory,
          description: ocrDesc,
          date: ocrDate ? new Date(ocrDate) : new Date()
        })
      });
      if (res.ok) {
        showToast("Transaksi pengeluaran berhasil dicatat!", "success");
        setShowOcrModal(false);
        setOcrAmount("");
        setOcrDesc("");
        setOcrImageSrc(null);
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(`Gagal mencatat transaksi: ${errorData.message || "Error"}`, "error");
      }
    } catch (err) {
      showToast("Kesalahan saat mencatat transaksi.", "error");
    }
  };

  const handleUpdateBalanceDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Menyimpan rincian rekening...", "info");
    try {
      const res = await fetch(`/api/accounts/${selectedAccId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: Number(newBalanceValue),
          monthlyInterest: selectedAccType === "BANK" ? Number(newInterestValue) : 0
        })
      });
      if (res.ok) {
        showToast("Rincian rekening berhasil diperbarui!", "success");
        setShowEditBalanceModal(false);
        setNewBalanceValue("");
        setNewInterestValue("");
        fetchData();
      } else {
        showToast("Gagal memperbarui rincian rekening.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat memperbarui rekening.", "error");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini? Saldo rekening Anda akan disesuaikan secara otomatis sesuai nominal transaksi.")) return;
    showToast("Menghapus transaksi...", "info");
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Transaksi berhasil dihapus. Saldo otomatis disesuaikan!", "success");
        fetchData();
      } else {
        showToast("Gagal menghapus transaksi.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghapus transaksi.", "error");
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus rekening "${selectedAccName}"? Tindakan ini bersifat permanen dan juga akan menghapus seluruh riwayat transaksi yang terhubung dengan rekening ini.`)) return;
    showToast("Menghapus rekening...", "info");
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast(`Rekening "${selectedAccName}" beserta riwayatnya berhasil dihapus!`, "success");
        setShowEditBalanceModal(false);
        fetchData();
      } else {
        showToast("Gagal menghapus rekening.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghapus rekening.", "error");
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Menyimpan batas anggaran...", "info");
    try {
      const res = await fetch("/api/user/limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit: Number(newLimitValue) })
      });
      
      if (res.ok) {
        showToast("Batas limit anggaran bulanan berhasil diperbarui!", "success");
        setShowLimitModal(false);
        await fetchData();
      } else {
        showToast("Gagal memperbarui batas anggaran.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat mengubah batas anggaran.", "error");
    }
  };

  if (status === "loading") return <div className="grid place-items-center h-screen bg-gray-50 text-gray-500 text-sm">Menyelaraskan dompet digital...</div>;

  const totalNetWorth = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  const totalMonthlyInterest = accounts
    .filter(acc => acc.type === "BANK" && acc.monthlyInterest && acc.monthlyInterest > 0)
    .reduce((acc, curr) => acc + (curr.monthlyInterest || 0), 0);

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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-800 antialiased flex flex-col">
      
      {/* HEADER */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 relative">
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
                      <span>Download App</span>
                    </button>
                  )}

                  {/* Keluar Button */}
                  <button 
                    onClick={() => {
                      setShowMenu(false);
                      showToast("Keluar dari sistem... Sampai jumpa lagi!", "success");
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

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* AREA KIRI: CARD UTAMA, LIMIT TRACKER & DAFTAR ASET */}
        <div className="md:col-span-2 space-y-6">
          
          {/* CARD TOTAL KEKAYAAN */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-3xl text-white shadow-lg shadow-green-100 relative overflow-hidden">
            {/* Background pattern decoration */}
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
              <svg width="200" height="200" viewBox="0 0 100 100" fill="currentColor">
                <circle cx="50" cy="50" r="50" />
              </svg>
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-sm opacity-80 font-medium">Total Aset Gabungan</p>
                <h1 className="text-3xl md:text-4xl font-black mt-1">Rp {totalNetWorth.toLocaleString("id-ID")}</h1>
              </div>
              {totalMonthlyInterest > 0 && (
                <div className="bg-red-500/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-red-500/30 text-right animate-pulse">
                  <p className="text-[9px] opacity-75 font-semibold uppercase tracking-wider">Bunga Bank Wajib / Bln</p>
                  <p className="text-xs font-extrabold text-red-100">Rp {totalMonthlyInterest.toLocaleString("id-ID")}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 mt-6 relative z-10">
              <button onClick={() => { if(accounts.length > 0) setShowTxModal(true); else alert("Tambahkan rekening bank terlebih dahulu!"); }} className="flex-1 min-w-[120px] bg-white text-green-700 font-bold py-2.5 px-3 rounded-xl text-xs hover:bg-green-50 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Catat Manual
              </button>
              <button onClick={() => { if(accounts.length > 0) setShowOcrModal(true); else alert("Tambahkan rekening bank terlebih dahulu!"); }} className="flex-1 min-w-[120px] bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs hover:bg-emerald-900 transition-all border border-emerald-700 shadow-sm cursor-pointer flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                Scan Struk
              </button>
              <button onClick={() => setShowAccModal(true)} className="bg-green-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-green-400 transition-all border border-green-400 cursor-pointer flex items-center justify-center gap-1.5">
                <span>+ Akun</span>
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
                    {acc.type === "BANK" && acc.monthlyInterest && acc.monthlyInterest > 0 ? (
                      <p className="text-[10px] text-red-500 font-semibold mt-1 flex items-center gap-1 bg-red-50/50 px-2 py-0.5 rounded-md w-fit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-red-400 animate-pulse">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                        </svg>
                        Bunga: Rp {acc.monthlyInterest.toLocaleString("id-ID")}/bln
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="font-extrabold text-sm text-gray-900">Rp {acc.balance.toLocaleString("id-ID")}</p>
                    <button 
                      onClick={() => {
                        setSelectedAccId(acc._id);
                        setSelectedAccName(acc.name);
                        setSelectedAccType(acc.type);
                        setNewBalanceValue(acc.balance.toString());
                        setNewInterestValue((acc.monthlyInterest || 0).toString());
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
                <div key={tx._id} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2 hover:bg-gray-50/50 rounded p-1 transition-all group">
                  <div>
                    <h5 className="font-bold text-gray-900">{tx.category} <span className="text-[10px] font-normal text-gray-400">({linkedAccount ? linkedAccount.name : 'Aset'})</span></h5>
                    <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{tx.description || "-"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold ${tx.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                      {tx.type === "INCOME" ? "+" : "-"} Rp {tx.amount.toLocaleString("id-ID")}
                    </p>
                    <button
                      onClick={() => handleDeleteTransaction(tx._id)}
                      className="text-gray-300 hover:text-red-500 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Hapus Transaksi"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50 animate-in fade-in duration-200">
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
                  <option value="INVESTMENT">INVESTASI</option>
                </select>
              </div>
              {accType === "BANK" && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block mb-1 font-semibold text-gray-600 flex justify-between">
                    <span>Bunga Bulanan Wajib Dibayar (Rp)</span>
                    <span className="text-[10px] text-gray-400 font-normal">Opsional</span>
                  </label>
                  <input type="number" placeholder="0" value={accInterest} onChange={e => setAccInterest(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black text-red-500 font-semibold" />
                </div>
              )}
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-1">Kelola Akun Keuangan</h3>
            <p className="text-xs text-gray-400 mb-4">Perbarui saldo dan rincian untuk: <span className="font-bold text-gray-700">{selectedAccName}</span></p>
            <form onSubmit={handleUpdateBalanceDirectly} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal Saldo Terbaru (Rp)</label>
                <input required type="number" value={newBalanceValue} onChange={e => setNewBalanceValue(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold text-green-600 focus:outline-none focus:border-green-500 text-black" />
              </div>
              {selectedAccType === "BANK" && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block mb-1 font-semibold text-gray-600 flex justify-between">
                    <span>Bunga Bulanan Wajib Dibayar (Rp)</span>
                    <span className="text-[10px] text-gray-400 font-normal">Opsional</span>
                  </label>
                  <input type="number" value={newInterestValue} onChange={e => setNewInterestValue(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold text-red-500 focus:outline-none focus:border-green-500 text-black" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditBalanceModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Simpan Perubahan</button>
              </div>
              <div className="pt-2 border-t border-gray-100 mt-2">
                <button 
                  type="button" 
                  onClick={() => handleDeleteAccount(selectedAccId)}
                  className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  Hapus Rekening / Dompet ini
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REKAM TRANSAKSI */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">Catat Keuangan</h3>
              <button 
                type="button" 
                onClick={() => {
                  setShowTxModal(false);
                  setShowOcrModal(true);
                }} 
                className="text-[10px] text-green-600 font-extrabold bg-green-50 hover:bg-green-100 py-1.5 px-2.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-green-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                Scan Struk
              </button>
            </div>
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

      {/* STYLE FOR OCR SCAN ANIMATION */}
      <style>{`
        .ocr-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(to right, transparent, #4ade80, transparent);
          box-shadow: 0 0 12px #4ade80;
          animation: scan-line-anim 2s ease-in-out infinite;
        }
        @keyframes scan-line-anim {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>

      {/* MODAL: SCAN STRUK (OCR) */}
      {showOcrModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col my-8 animate-in slide-in-from-bottom-8 duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">Pemindai Struk Pintar</h3>
                  <p className="text-[10px] text-green-100 font-medium">Scan struk belanja & catat pengeluaran otomatis</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowOcrModal(false);
                  setOcrImageSrc(null);
                  setOcrAmount("");
                  setOcrDesc("");
                }} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Image upload area / preview area */}
              {!ocrImageSrc ? (
                <div className="border-2 border-dashed border-gray-200 hover:border-green-400 rounded-2xl p-8 text-center bg-gray-50/50 hover:bg-green-50/10 transition-all group flex flex-col items-center justify-center relative cursor-pointer min-h-[180px]">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleOcrFileChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group-hover:scale-110 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-green-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                  </div>
                  <h4 className="mt-4 font-bold text-gray-800 text-xs">Pilih atau Ambil Foto Struk</h4>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-[240px]">Ambil gambar secara langsung menggunakan kamera HP atau unggah file foto struk belanja Anda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Photo Preview with Scanning Animation */}
                  <div className="relative border border-gray-100 rounded-2xl overflow-hidden aspect-video bg-gray-50 flex items-center justify-center max-h-[220px]">
                    <img 
                      src={ocrImageSrc} 
                      alt="Preview Struk" 
                      className="max-h-full max-w-full object-contain"
                    />
                    
                    {/* Glowing Green Scan Line Animation */}
                    {isScanning && (
                      <div className="absolute inset-0 bg-black/10 flex flex-col justify-between overflow-hidden">
                        <div className="ocr-scan-line" />
                        <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[1px] flex items-center justify-center flex-col">
                          <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-100 flex items-center gap-3">
                            {/* Modern loading spinner */}
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                            <div>
                              <p className="font-extrabold text-[11px] text-gray-800 leading-tight">Sedang Membaca Struk ({scanProgress}%)</p>
                              <p className="text-[9px] text-gray-400 mt-0.5">Mengekstrak teks & menganalisis total belanja...</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action to change photo */}
                  {!isScanning && (
                    <div className="flex justify-end">
                      <label className="text-[10px] text-green-600 hover:text-green-700 bg-green-50 font-bold py-1.5 px-3 rounded-lg cursor-pointer flex items-center gap-1.5 border border-green-100">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Ganti Foto Struk</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleOcrFileChange} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Parsed Result & Edit Form */}
              {ocrImageSrc && !isScanning && (
                <form onSubmit={handleAddOcrTransaction} className="space-y-4 text-xs animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 space-y-3">
                    <p className="font-bold text-[10px] text-emerald-800 uppercase tracking-wider">Hasil Analisis Pemindai</p>
                    
                    {/* Amount detected */}
                    <div className="grid grid-cols-1 gap-1">
                      <label className="font-semibold text-gray-500 text-[10px]">Nominal Belanja Terdeteksi (Rp)</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 font-extrabold text-sm text-gray-400">Rp</span>
                        <input 
                          required 
                          type="number" 
                          placeholder="Masukkan nominal" 
                          value={ocrAmount} 
                          onChange={e => setOcrAmount(e.target.value)} 
                          className="w-full border p-2.5 pl-9 rounded-xl text-base font-extrabold text-green-700 bg-white focus:outline-none focus:border-green-500 text-black" 
                        />
                      </div>
                      {ocrAmount && (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                          Terformat: Rp {Number(ocrAmount).toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 font-semibold text-gray-600">Pilih Rekening Asal</label>
                      <select 
                        value={ocrAccount} 
                        onChange={e => setOcrAccount(e.target.value)} 
                        className="w-full border p-2.5 rounded-xl bg-white text-black text-xs font-semibold focus:outline-none focus:border-green-500"
                      >
                        {accounts.map(a => <option key={a._id} value={a._id}>{a.name} (Rp {a.balance.toLocaleString("id-ID")})</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block mb-1 font-semibold text-gray-600">Kategori Pengeluaran</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="Contoh: Makanan, Belanja Harian" 
                        value={ocrCategory} 
                        onChange={e => setOcrCategory(e.target.value)} 
                        className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-green-500" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1 font-semibold text-gray-600">Keterangan / Nama Toko</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: Alfamart Sudirman, Makan Siang Bakso" 
                        value={ocrDesc} 
                        onChange={e => setOcrDesc(e.target.value)} 
                        className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-green-500" 
                      />
                    </div>

                    <div>
                      <label className="block mb-1 font-semibold text-gray-600">Tanggal Struk</label>
                      <input 
                        required 
                        type="date" 
                        value={ocrDate} 
                        onChange={e => setOcrDate(e.target.value)} 
                        className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-green-500 font-semibold" 
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowOcrModal(false);
                        setOcrImageSrc(null);
                        setOcrAmount("");
                        setOcrDesc("");
                      }} 
                      className="flex-1 bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer text-center text-gray-700"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition-all text-xs cursor-pointer shadow-md shadow-green-100"
                    >
                      Simpan Pengeluaran
                    </button>
                  </div>
                </form>
              )}
            </div>
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
                  Untuk Pengguna iOS (Safari)
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
                  Untuk Pengguna Android / Laptop (Chrome)
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

      {/* FOOTER BRANDING */}
      <footer className="max-w-6xl mx-auto text-center mt-auto pt-12 pb-4 text-[11px] text-gray-400">
        <p className="font-medium">
          developed by{" "}
          <a
            href="https://www.naufalpratomo.my.id/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 hover:text-green-700 font-bold transition-all underline decoration-dotted underline-offset-4 cursor-pointer"
          >
            Muhammad Naufal Pratomo
          </a>
        </p>
        <p className="text-[10px] text-gray-300 mt-0.5">© {new Date().getFullYear()} frugalin.aja. All rights reserved.</p>
      </footer>

    </div>
  );
}