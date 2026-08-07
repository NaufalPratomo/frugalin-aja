"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "../../components/Toast";
import SplashScreen from "../../components/SplashScreen";

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
  toAccountId?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface BillType {
  _id: string;
  name: string;
  amount: number;
  category: string;
  dueDate: number;
  accountId: string;
  status: 'UNPAID' | 'PAID';
  lastPaidDate?: string;
}

interface BudgetType {
  _id: string;
  category: string;
  limit: number;
}

interface SavingsGoalType {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  monthlyContribution?: number;
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
    /total\s*bayar/i,
    /total/i,
    /subtotal/i,
    /jumlah\s*total/i,
    /jumlah/i,
    /netto/i,
    /amount/i,
    /bayar/i,
    /rp\.?\s*\d+/i,
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
            // Increased maximum limit to 1 Billion to accommodate wholesale/grosir receipts
            if (val > 100 && val <= 1000000000) {
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
        if (val > maxVal && val <= 1000000000) {
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

  // Expanded to support dot (.) as date separator (common in Indonesian receipts, e.g. 10.01.2023)
  const dateRegexes = [
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/,
    /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/
  ];

  for (const regex of dateRegexes) {
    const match = text.match(regex);
    if (match) {
      let day = 0;
      let month = 0;
      let year = 0;

      if (match[1].length === 4) {
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else {
        day = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        let yrStr = match[3];
        if (yrStr.length === 2) yrStr = "20" + yrStr;
        year = parseInt(yrStr, 10);
      }

      // Validate date bounds to prevent matching arbitrary numbers like times or prices
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        detectedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        break;
      }
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

function getBudgetCategoryGroup(category: string): string {
  if (!category) return "Lainnya";
  const cat = category.toLowerCase().trim();
  
  if (/makan|minum|kopi|cafe|resto|warung|food|beverage|coffe|coffee|teh|chicken|burger|pizza|kuliner|dapur|roti|bakery|gofood|grabfood|shopeefood|nasi|ayam|sate|soto|gudeg|rawon|pecel|lalapan|jus|es\s|snack|cemilan|gorengan|kue|jajan|kantin|catering|bakso|mie|indomie|noodle|steak|sushi|ramen|boba|bubble|dimsum|seafood|ikan|daging|sayur|buah|salad|dessert|ice\s*cream|gelato|donat|martabak|kebab|shawarma|pempek|siomay|batagor|seblak|cilok|cimol|sempol|ricebowl|rice\s*bowl/i.test(cat)) {
    return "Makanan & Minuman";
  }
  
  if (/transport|bensin|pertamina|spbu|shell|gojek|grab|uber|ojek|taxi|taksi|tol|parkir|tiket|kereta|pesawat|travel|krl|mrt|goride|grabcab|gocar|motor|mobil|ban|oli|servis|service|bengkel|shock|breaker|sparepart|spare\s*part|knalpot|aki|radiator|kampas|rem|kopling|rantai|helm|otomotif|cuci\s*mobil|cuci\s*motor|tune\s*up|ganti\s*oli|velg|kaca|wiper|lampu\s*mobil|lampu\s*motor|body\s*repair|ketok\s*magic|derek|onderdil|variasi|modifikasi|angkot|bus|busway|transjakarta|damri|kapal|ferry|ojol|maxim|indriver|stnk|pajak\s*kendaraan|sim|perpanjang/i.test(cat)) {
    return "Transportasi";
  }
  
  if (/belanja|harian|mart|indo|alfa|super|pasar|hiper|shop|store|sabun|odol|detergen|susu|sembako|minyak|beras|trans|carefour|lotte|baju|celana|sepatu|fashion|mall|toko|laundry|dry\s*clean|alat|peralatan|elektronik|hp|handphone|gadget|furniture|rumah\s*tangga|gas|lpg|galon|tissue|shampo|shampoo|kondisioner|parfum|kosmetik|makeup|skincare|perawatan|sandal|tas|dompet|jam\s*tangan|aksesoris|kacamata|kaos|jaket|hoodie|kemeja|batik|mukena|sarung|perlengkapan|atk|alat\s*tulis|print|fotocopy|pulpen/i.test(cat)) {
    return "Belanja & Harian";
  }
  
  if (/tagihan|pulsa|wifi|internet|netflix|spotify|youtube|disney|listrik|token|bpjs|pdam|langganan|subscription|cicilan|kredit|angsuran|pinjaman|sewa|kos|kost|kontrakan|indihome|telkomsel|xl|axis|tri|smartfren|iuran|pajak|asuransi|premi|kartu\s*kredit|gopay|ovo|dana|shopeepay|top\s*up|topup|e-money|emoney|e-toll|etoll|paket\s*data|kuota|hosting|domain|cloud|vps|apple|icloud|google\s*one/i.test(cat)) {
    return "Tagihan & Pulsa";
  }

  if (/sehat|sakit|dokter|obat|rs|rumah\s*sakit|klinik|apotek|vitamin|gym|fitness|olahraga|supplement|suplemen|check\s*up|checkup|medical|lab|laboratorium|rontgen|usg|rawat|operasi|gigi|mata|tht|kulit|psikolog|terapi|fisioterapi|vaksin|imunisasi|pijat|massage|herbal|farmasi/i.test(cat)) {
    return "Kesehatan";
  }

  if (/hiburan|rekreasi|nonton|bioskop|travel|hotel|liburan|game|topup\s*game|playstation|wisata|piknik|camping|renang|kolam|taman|pantai|gunung|villa|resort|airbnb|konser|musik|festival|karaoke|bowling|billiard|escape\s*room|theme\s*park|dufan|ancol|waterpark|tiket\s*masuk|zoo|kebun\s*binatang|museum|cinema|cgv|xxi|imax|steam|ps5|ps4|nintendo|xbox|mobile\s*legend|free\s*fire|valorant|manga|komik|buku|novel|mainan|hobi|fotografi|kamera/i.test(cat)) {
    return "Hiburan & Rekreasi";
  }

  return "Lainnya";
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [transactions, setTransactions] = useState<TransactionType[]>([]);
  const [historyTransactions, setHistoryTransactions] = useState<TransactionType[]>([]);
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [txPage, setTxPage] = useState<number>(1);
  const [hasMoreTx, setHasMoreTx] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0);
  const [budgetMode, setBudgetMode] = useState<'ADAPTIVE' | 'STRICT'>('ADAPTIVE');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeChartTab, setActiveChartTab] = useState<'flow' | 'assets'>('flow');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showBalance, setShowBalance] = useState(false);

  // Budgets state
  const [budgets, setBudgets] = useState<BudgetType[]>([]);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  // Savings Goals state
  const [savings, setSavings] = useState<SavingsGoalType[]>([]);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [savingTarget, setSavingTarget] = useState("");
  const [savingCurrent, setSavingCurrent] = useState("");
  const [savingDate, setSavingDate] = useState("");
  const [savingMonthly, setSavingMonthly] = useState("");

  // Add Funds to Savings state
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [selectedSavingId, setSelectedSavingId] = useState("");
  const [addFundsValue, setAddFundsValue] = useState("");

  // Modals state
  const [showAccModal, setShowAccModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Bill Tracker states
  const [bills, setBills] = useState<BillType[]>([]);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("Tagihan & Pulsa");
  const [billDueDate, setBillDueDate] = useState("1");
  const [billAccount, setBillAccount] = useState("");

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
  const [txToAccount, setTxToAccount] = useState(""); // Rekening tujuan transfer
  const [txType, setTxType] = useState("EXPENSE");
  const [txAmount, setTxAmount] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txDesc, setTxDesc] = useState("");

  // AI Category Detection state
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiCategoryLoading, setAiCategoryLoading] = useState(false);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchHistoryTransactions = async (page: number, append: boolean = false) => {
    try {
      const resHistoryTx = await fetch(`/api/transactions?month=${filterMonth}&year=${filterYear}&page=${page}&limit=20`);
      const dataHistoryTx = await resHistoryTx.json();
      if (Array.isArray(dataHistoryTx)) {
        if (append) {
          setHistoryTransactions(prev => {
            // Avoid duplicate items
            const existingIds = new Set(prev.map(item => item._id));
            const uniqueNew = dataHistoryTx.filter(item => !existingIds.has(item._id));
            return [...prev, ...uniqueNew];
          });
        } else {
          setHistoryTransactions(dataHistoryTx);
        }
        setHasMoreTx(dataHistoryTx.length === 20);
      }
    } catch (e) {
      console.error("Gagal sinkronisasi riwayat transaksi", e);
    }
  };

  const fetchData = async () => {
    try {
      const resAcc = await fetch("/api/accounts");
      const dataAcc = await resAcc.json();
      if (Array.isArray(dataAcc)) {
        setAccounts(dataAcc);
        if (dataAcc.length > 0) {
          if (!txAccount) setTxAccount(dataAcc[0]._id);
          if (dataAcc.length > 1) {
            if (!txToAccount) setTxToAccount(dataAcc[1]._id);
          } else {
            if (!txToAccount) setTxToAccount(dataAcc[0]._id);
          }
          if (!ocrAccount) setOcrAccount(dataAcc[0]._id);
          if (!billAccount) setBillAccount(dataAcc[0]._id);
        }
      }

      const resTx = await fetch(`/api/transactions?year=${selectedYear}`);
      const dataTx = await resTx.json();
      if (Array.isArray(dataTx)) setTransactions(dataTx);

      await fetchHistoryTransactions(1, false);
      setTxPage(1);

      // KODE LOGIKA PENYANGGA UNTUK LIMIT ANGGARAN
      const resLimit = await fetch("/api/user/limit");
      const dataLimit = await resLimit.json();
      
      console.log("Data Limit dari API:", dataLimit);

      if (dataLimit && typeof dataLimit.monthlyLimit === "number") {
        setMonthlyLimit(dataLimit.monthlyLimit);
        setNewLimitValue(dataLimit.monthlyLimit.toString());
        if (dataLimit.budgetMode) setBudgetMode(dataLimit.budgetMode);
      } else if (dataLimit && dataLimit.monthlyLimit !== undefined) {
        setMonthlyLimit(Number(dataLimit.monthlyLimit));
        setNewLimitValue(dataLimit.monthlyLimit.toString());
        if (dataLimit.budgetMode) setBudgetMode(dataLimit.budgetMode);
      }

      // Ambil data tagihan berulang
      const resBills = await fetch("/api/bills");
      const dataBills = await resBills.json();
      if (Array.isArray(dataBills)) setBills(dataBills);

      // Ambil data anggaran per kategori
      const resBudgets = await fetch("/api/budgets");
      const dataBudgets = await resBudgets.json();
      if (Array.isArray(dataBudgets)) setBudgets(dataBudgets);

      // Ambil data target tabungan
      const resSavings = await fetch("/api/savings");
      const dataSavings = await resSavings.json();
      if (Array.isArray(dataSavings)) setSavings(dataSavings);
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
    if (status === "authenticated") {
      setTxPage(1);
      fetchHistoryTransactions(1, false);
    }
  }, [filterMonth, filterYear, status]);

  useEffect(() => {
    if (status === "authenticated") {
      const fetchChartTx = async () => {
        try {
          const resTx = await fetch(`/api/transactions?year=${selectedYear}`);
          const dataTx = await resTx.json();
          if (Array.isArray(dataTx)) setTransactions(dataTx);
        } catch (e) {
          console.error("Gagal sinkronisasi data grafik keuangan", e);
        }
      };
      fetchChartTx();
    }
  }, [selectedYear, status]);

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

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Membuat tagihan berulang baru...", "info");
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: billName,
          amount: Number(billAmount),
          category: billCategory,
          dueDate: Number(billDueDate),
          accountId: billAccount
        })
      });
      if (res.ok) {
        showToast(`Tagihan "${billName}" berhasil didaftarkan!`, "success");
        setShowBillModal(false);
        setBillName("");
        setBillAmount("");
        fetchData();
      } else {
        showToast("Gagal membuat tagihan baru.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghubungkan ke server.", "error");
    }
  };

  const handlePayBill = async (id: string) => {
    showToast("Memproses pembayaran tagihan...", "info");
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PAY" })
      });
      if (res.ok) {
        showToast("Tagihan berhasil dibayar!", "success");
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Gagal membayar tagihan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat memproses pembayaran.", "error");
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tagihan berulang ini?")) return;
    showToast("Menghapus tagihan...", "info");
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Tagihan berhasil dihapus!", "success");
        fetchData();
      } else {
        showToast("Gagal menghapus tagihan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghapus tagihan.", "error");
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

  // AI fallback categorizer — called with debounce when description changes
  useEffect(() => {
    if (!txDesc || txType === "TRANSFER") {
      setAiCategory(null);
      setAiCategoryLoading(false);
      return;
    }

    const regexCategory = getBudgetCategoryGroup(txDesc);
    if (regexCategory !== "Lainnya") {
      // Regex detected a known category — no need for AI
      setAiCategory(null);
      setAiCategoryLoading(false);
      return;
    }

    // Regex returned "Lainnya" — ask AI to confirm
    setAiCategoryLoading(true);
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);

    aiDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: txDesc }),
        });
        const data = await res.json();
        setAiCategory(data.category || "Lainnya");
      } catch {
        setAiCategory("Lainnya");
      } finally {
        setAiCategoryLoading(false);
      }
    }, 3000);

    return () => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    };
  }, [txDesc, txType]);

  // Resolve final category: regex first, then AI fallback
  const resolveCategory = (desc: string): string => {
    const regexResult = getBudgetCategoryGroup(desc || "Lainnya");
    if (regexResult !== "Lainnya") return regexResult;
    return aiCategory || "Lainnya";
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Mencatat transaksi keuangan...", "info");
    try {
      const isTransfer = txType === "TRANSFER";
      if (isTransfer && txAccount === txToAccount) {
        showToast("Rekening asal dan tujuan tidak boleh sama!", "error");
        return;
      }

      // Use AI category if regex returned Lainnya and AI has a better answer
      let finalCategory = "Transfer";
      if (!isTransfer) {
        const regexCat = getBudgetCategoryGroup(txDesc || "Lainnya");
        if (regexCat === "Lainnya" && aiCategory && aiCategory !== "Lainnya") {
          finalCategory = aiCategory;
        } else {
          finalCategory = regexCat;
        }
      }

      const payload = {
        accountId: txAccount,
        toAccountId: isTransfer ? txToAccount : undefined,
        type: txType,
        amount: Number(txAmount),
        category: finalCategory,
        description: txDesc
      };
      
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(isTransfer ? "Dana berhasil ditransfer!" : "Transaksi keuangan berhasil dicatat!", "success");
        setShowTxModal(false);
        setTxAmount("");
        setTxCategory("");
        setTxDesc("");
        fetchData();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || "Gagal mencatat transaksi.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat mencatat transaksi.", "error");
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast(editingBudgetId ? "Mengubah batas anggaran kategori..." : "Menyimpan batas anggaran kategori...", "info");
    try {
      const url = "/api/budgets";
      const method = editingBudgetId ? "PUT" : "POST";
      const body = editingBudgetId 
        ? { id: editingBudgetId, category: budgetCategory, limit: Number(budgetLimit) }
        : { category: budgetCategory, limit: Number(budgetLimit) };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast(
          editingBudgetId 
            ? `Batas anggaran kategori "${budgetCategory}" berhasil diubah!` 
            : `Batas anggaran kategori "${budgetCategory}" disimpan!`, 
          "success"
        );
        setShowBudgetModal(false);
        setBudgetCategory("");
        setBudgetLimit("");
        setEditingBudgetId(null);
        fetchData();
      } else {
        showToast("Gagal menyimpan anggaran.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menyimpan anggaran.", "error");
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus anggaran kategori ini?")) return;
    showToast("Menghapus anggaran...", "info");
    try {
      const res = await fetch(`/api/budgets?id=${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Anggaran kategori berhasil dihapus!", "success");
        fetchData();
      } else {
        showToast("Gagal menghapus anggaran.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghapus anggaran.", "error");
    }
  };

  const handleAddSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Membuat target tabungan baru...", "info");
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savingName,
          targetAmount: Number(savingTarget),
          currentAmount: Number(savingCurrent || 0),
          targetDate: savingDate || undefined,
          monthlyContribution: Number(savingMonthly || 0)
        })
      });
      if (res.ok) {
        showToast(`Target tabungan "${savingName}" berhasil dibuat!`, "success");
        setShowSavingsModal(false);
        setSavingName("");
        setSavingTarget("");
        setSavingCurrent("");
        setSavingDate("");
        setSavingMonthly("");
        fetchData();
      } else {
        showToast("Gagal membuat target tabungan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat membuat target tabungan.", "error");
    }
  };

  const handleDeleteSavingsGoal = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus target tabungan ini?")) return;
    showToast("Menghapus target...", "info");
    try {
      const res = await fetch(`/api/savings/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Target tabungan berhasil dihapus!", "success");
        fetchData();
      } else {
        showToast("Gagal menghapus target tabungan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menghapus target tabungan.", "error");
    }
  };

  const handleAddSavingsFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFundsValue) return;
    showToast("Menambahkan dana tabungan...", "info");
    try {
      const res = await fetch(`/api/savings/${selectedSavingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_FUNDS",
          addAmount: Number(addFundsValue)
        })
      });
      if (res.ok) {
        showToast("Dana berhasil ditambahkan ke tabungan!", "success");
        setShowAddFundsModal(false);
        setAddFundsValue("");
        fetchData();
      } else {
        showToast("Gagal menambahkan dana tabungan.", "error");
      }
    } catch (err) {
      showToast("Kesalahan saat menambahkan dana.", "error");
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
    setScanProgress(25);
    showToast("Mengunggah dan memproses struk dengan AI...", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setScanProgress(60);

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      setScanProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Gagal memproses struk.");
      }

      const parsed = await response.json();

      // Update forms state with detected data from AI
      setOcrAmount(parsed.amount ? parsed.amount.toString() : "");
      setOcrCategory(parsed.category || "Belanja & Harian");
      setOcrDesc(parsed.description || "Belanja Struk");
      setOcrDate(parsed.date || new Date().toISOString().split("T")[0]);
      
      setScanProgress(100);
      showToast("Pemindaian dengan AI selesai!", "success");
    } catch (err: any) {
      console.error("OCR Scan Error:", err);
      showToast(err.message || "Gagal melakukan scan OCR. Silakan coba lagi.", "error");
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

  const handleModeToggle = async (newMode: 'ADAPTIVE' | 'STRICT') => {
    setBudgetMode(newMode);
    try {
      const res = await fetch("/api/user/limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit, budgetMode: newMode })
      });
      if (res.ok) {
        showToast(`Mode budget diubah ke: ${newMode === 'ADAPTIVE' ? 'Adaptif (Carry-Over)' : 'Strict Flat (25%)'}`, "success");
      }
    } catch (e) {
      console.error("Gagal memperbarui mode budget", e);
    }
  };

  const handleUpdateLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    showToast("Menyimpan batas anggaran...", "info");
    try {
      const res = await fetch("/api/user/limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyLimit: Number(newLimitValue), budgetMode })
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

  if (status === "loading") return <SplashScreen />;

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

  // Hitung pengeluaran per minggu dengan Penyesuaian Otomatis (Dynamic Carry-over)
  const initialWeeklyLimit = monthlyLimit > 0 ? Math.round(monthlyLimit / 4) : 0;
  const currentDate = new Date().getDate();
  const currentWeekIndex = currentDate <= 7 ? 1 : currentDate <= 14 ? 2 : currentDate <= 21 ? 3 : 4;
  
  const currentMonthExpenseTxs = transactions.filter(tx => {
    const d = new Date(tx.date);
    return tx.type === "EXPENSE" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const w1Spent = currentMonthExpenseTxs.filter(tx => new Date(tx.date).getDate() >= 1 && new Date(tx.date).getDate() <= 7).reduce((sum, tx) => sum + tx.amount, 0);
  const w2Spent = currentMonthExpenseTxs.filter(tx => new Date(tx.date).getDate() >= 8 && new Date(tx.date).getDate() <= 14).reduce((sum, tx) => sum + tx.amount, 0);
  const w3Spent = currentMonthExpenseTxs.filter(tx => new Date(tx.date).getDate() >= 15 && new Date(tx.date).getDate() <= 21).reduce((sum, tx) => sum + tx.amount, 0);
  const w4Spent = currentMonthExpenseTxs.filter(tx => new Date(tx.date).getDate() >= 22).reduce((sum, tx) => sum + tx.amount, 0);

  const rawWeeklySpents = [w1Spent, w2Spent, w3Spent, w4Spent];

  // Hitung total pengeluaran sejauh ini di bulan ini (termasuk minggu berjalan)
  const totalSpentSoFar = w1Spent + w2Spent + w3Spent + w4Spent;
  const remainingMonthlyBudgetRealtime = Math.max(0, monthlyLimit - totalSpentSoFar);
  const futureWeeksCount = 4 - currentWeekIndex;

  // Limit anggaran untuk minggu-minggu berikutnya setelah minggu berjalan
  const futureWeeklyLimit = (monthlyLimit > 0 && futureWeeksCount > 0)
    ? Math.round(remainingMonthlyBudgetRealtime / futureWeeksCount)
    : 0;

  // Limit anggaran untuk minggu berjalan (ditentukan dari sisa budget pada awal minggu ini)
  const pastWeeksSpentBeforeCurrent = rawWeeklySpents.slice(0, currentWeekIndex - 1).reduce((sum, val) => sum + val, 0);
  const weeksLeftFromCurrent = 4 - (currentWeekIndex - 1);
  const currentWeekTargetLimit = monthlyLimit > 0
    ? Math.round(Math.max(0, monthlyLimit - pastWeeksSpentBeforeCurrent) / weeksLeftFromCurrent)
    : 0;

  const isStrict = budgetMode === 'STRICT';

  const weeklyBreakdown = [
    {
      id: 1,
      label: "Minggu 1",
      range: "1-7",
      isCurrent: currentWeekIndex === 1,
      spent: w1Spent,
      targetLimit: isStrict ? initialWeeklyLimit : (currentWeekIndex === 1 ? currentWeekTargetLimit : initialWeeklyLimit),
    },
    {
      id: 2,
      label: "Minggu 2",
      range: "8-14",
      isCurrent: currentWeekIndex === 2,
      spent: w2Spent,
      targetLimit: isStrict ? initialWeeklyLimit : (currentWeekIndex === 2 ? currentWeekTargetLimit : currentWeekIndex > 2 ? initialWeeklyLimit : futureWeeklyLimit),
    },
    {
      id: 3,
      label: "Minggu 3",
      range: "15-21",
      isCurrent: currentWeekIndex === 3,
      spent: w3Spent,
      targetLimit: isStrict ? initialWeeklyLimit : (currentWeekIndex === 3 ? currentWeekTargetLimit : currentWeekIndex > 3 ? initialWeeklyLimit : futureWeeklyLimit),
    },
    {
      id: 4,
      label: "Minggu 4+",
      range: "22+",
      isCurrent: currentWeekIndex === 4,
      spent: w4Spent,
      targetLimit: isStrict ? initialWeeklyLimit : (currentWeekIndex === 4 ? currentWeekTargetLimit : futureWeeklyLimit),
    },
  ];

  const activeWeekData = weeklyBreakdown.find(w => w.isCurrent) || weeklyBreakdown[0];
  const activeWeekTarget = activeWeekData.targetLimit || initialWeeklyLimit;
  const activeWeekPct = activeWeekTarget > 0 ? (activeWeekData.spent / activeWeekTarget) * 100 : 0;

  // LOGIKA PROYEKSI PENGELUARAN AKHIR BULAN (Month-End Forecasting)
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysPassed = currentDate;
  const dailyBurnRate = daysPassed > 0 ? Math.round(totalMonthlyExpense / daysPassed) : 0;
  const projectedMonthEndExpense = Math.round(dailyBurnRate * daysInCurrentMonth);
  const isProjectedOverLimit = monthlyLimit > 0 && projectedMonthEndExpense > monthlyLimit;
  const projectionDiff = monthlyLimit > 0 ? Math.abs(projectedMonthEndExpense - monthlyLimit) : 0;

  const filteredTransactions = historyTransactions.filter(tx => {
    if (filterType === "ALL") return true;
    const targetAccount = accounts.find(a => a._id === tx.accountId);
    return targetAccount?.type === filterType;
  });

  // -------------------------------------------------------------
  // LOGIKA GRAFIK HISTORY KEUANGAN
  // -------------------------------------------------------------
  const years = Array.from(
    new Set([
      new Date().getFullYear(),
      ...transactions.map(t => new Date(t.date).getFullYear())
    ])
  ).sort((a, b) => b - a);

  // Perhitungan Pemasukan & Pengeluaran bulanan untuk tahun terpilih
  const monthlyIncome = Array(12).fill(0);
  const monthlyExpense = Array(12).fill(0);

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (txDate.getFullYear() === selectedYear) {
      const monthIndex = txDate.getMonth();
      if (tx.type === "INCOME") {
        monthlyIncome[monthIndex] += tx.amount;
      } else if (tx.type === "EXPENSE") {
        monthlyExpense[monthIndex] += tx.amount;
      }
    }
  });

  // Perhitungan mundur Total Aset Gabungan per akhir bulan
  const monthlyAssets = Array(12).fill(0);
  const runningBalances: Record<string, number> = {};
  accounts.forEach((acc) => {
    runningBalances[acc._id] = acc.balance;
  });

  const sortedTx = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const nowTime = new Date().getTime();
  let txIndex = 0;

  for (let m = 11; m >= 0; m--) {
    const endOfMonth = new Date(selectedYear, m + 1, 0, 23, 59, 59, 999);
    
    if (endOfMonth.getTime() > nowTime) {
      // Jika bulan ini di masa depan, isi dengan net worth saat ini
      monthlyAssets[m] = Object.values(runningBalances).reduce((sum, bal) => sum + bal, 0);
    } else {
      // Revert transaksi yang terjadi SETELAH endOfMonth
      while (txIndex < sortedTx.length) {
        const tx = sortedTx[txIndex];
        const txTime = new Date(tx.date).getTime();
        
        if (txTime > endOfMonth.getTime()) {
          // Revert transaksi ini dari runningBalances
          if (runningBalances[tx.accountId] !== undefined) {
            if (tx.type === "INCOME") {
              runningBalances[tx.accountId] -= tx.amount;
            } else if (tx.type === "EXPENSE") {
              runningBalances[tx.accountId] += tx.amount;
            } else if (tx.type === "TRANSFER") {
              runningBalances[tx.accountId] += tx.amount;
              if (tx.toAccountId && runningBalances[tx.toAccountId] !== undefined) {
                runningBalances[tx.toAccountId] -= tx.amount;
              }
            }
          }
          txIndex++;
        } else {
          break;
        }
      }
      
      monthlyAssets[m] = Object.values(runningBalances).reduce((sum, bal) => sum + bal, 0);
    }
  }

  // Format rupiah pendek
  const formatRupiahShort = (value: number) => {
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}Jt`;
    if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}Rb`;
    return `Rp ${value}`;
  };

  // Hitung pengeluaran per kategori bulan ini
  const categoryExpenses: Record<string, number> = {};
  transactions.forEach(tx => {
    if (tx.type === "EXPENSE") {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const group = getBudgetCategoryGroup(tx.category);
        categoryExpenses[group] = (categoryExpenses[group] || 0) + tx.amount;
      }
    }
  });

  // DYNAMIC INSIGHTS GENERATION
  const getDynamicInsights = () => {
    const insights: string[] = [];
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const lastMonth = curMonth === 0 ? 11 : curMonth - 1;
    const lastMonthYear = curMonth === 0 ? curYear - 1 : curYear;

    const categoryTotalsCur: Record<string, number> = {};
    const categoryTotalsLast: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type !== "EXPENSE") return;
      const txDate = new Date(tx.date);
      const m = txDate.getMonth();
      const y = txDate.getFullYear();
      const cat = getBudgetCategoryGroup(tx.category);

      if (m === curMonth && y === curYear) {
        categoryTotalsCur[cat] = (categoryTotalsCur[cat] || 0) + tx.amount;
      } else if (m === lastMonth && y === lastMonthYear) {
        categoryTotalsLast[cat] = (categoryTotalsLast[cat] || 0) + tx.amount;
      }
    });

    let maxIncreaseCat = "";
    let maxIncreasePct = 0;
    Object.keys(categoryTotalsCur).forEach(cat => {
      const curAmt = categoryTotalsCur[cat];
      const lastAmt = categoryTotalsLast[cat] || 0;
      if (lastAmt > 10000) {
        const pct = ((curAmt - lastAmt) / lastAmt) * 100;
        if (pct > maxIncreasePct) {
          maxIncreasePct = pct;
          maxIncreaseCat = cat;
        }
      }
    });

    if (maxIncreaseCat && maxIncreasePct > 5) {
      insights.push(`Pengeluaran untuk "${maxIncreaseCat}" naik ${maxIncreasePct.toFixed(0)}% dari bulan lalu.`);
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyExpenses = transactions
      .filter(tx => tx.type === "EXPENSE" && new Date(tx.date) >= oneWeekAgo)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    if (weeklyExpenses.length > 0) {
      const formattedTxs = weeklyExpenses.map(tx => `Rp ${tx.amount.toLocaleString("id-ID")} (${tx.category})`).join(", ");
      insights.push(`3 transaksi terbesar minggu ini: ${formattedTxs}.`);
    }

    let topCat = "";
    let topCatAmt = 0;
    let totalCurMonthExp = 0;
    Object.keys(categoryTotalsCur).forEach(cat => {
      const amt = categoryTotalsCur[cat];
      totalCurMonthExp += amt;
      if (amt > topCatAmt) {
        topCatAmt = amt;
        topCat = cat;
      }
    });

    if (topCat && totalCurMonthExp > 0) {
      const topCatPct = (topCatAmt / totalCurMonthExp) * 100;
      insights.push(`Kategori "${topCat}" menyumbang ${topCatPct.toFixed(0)}% dari total pengeluaran bulan ini.`);
    }

    if (insights.length === 0) {
      insights.push("Luar biasa! Belum ada lonjakan pengeluaran atau transaksi mencurigakan minggu ini.");
      insights.push("Tips: Tetapkan limit anggaran per kategori untuk mengontrol pengeluaran dengan lebih presisi.");
    }

    return insights;
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

  // SVG Config
  const svgWidth = 600;
  const svgHeight = 240;
  const paddingLeft = 65;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxFlow = Math.max(...monthlyIncome, ...monthlyExpense, 100000);
  const maxAsset = Math.max(...monthlyAssets, 100000);

  const yMaxFlow = Math.ceil(maxFlow * 1.15);
  const yMaxAsset = Math.ceil(maxAsset * 1.15);

  const getX = (index: number) => paddingLeft + (index * chartWidth) / 11;
  const getXBar = (index: number) => paddingLeft + (index * chartWidth / 12) + (chartWidth / 24);
  const getYFlow = (val: number) => (svgHeight - paddingBottom) - (val / yMaxFlow) * chartHeight;
  const getYAsset = (val: number) => (svgHeight - paddingBottom) - (val / yMaxAsset) * chartHeight;

  let assetPathD = "";
  let assetAreaD = "";
  for (let i = 0; i < 12; i++) {
    const x = getX(i);
    const y = getYAsset(monthlyAssets[i]);
    if (i === 0) {
      assetPathD += `M ${x} ${y}`;
      assetAreaD += `M ${x} ${svgHeight - paddingBottom} L ${x} ${y}`;
    } else {
      assetPathD += ` L ${x} ${y}`;
      assetAreaD += ` L ${x} ${y}`;
    }
  }
  if (monthlyAssets.length > 0) {
    assetAreaD += ` L ${getX(11)} ${svgHeight - paddingBottom} Z`;
  }

  const renderTransactionHistory = (customHeightClass: string) => {
    return (
      <div className={`bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col ${customHeightClass}`}>
        <h3 className="font-bold text-gray-900 mb-2 text-sm">Riwayat Transaksi</h3>

        {/* MONTH & YEAR FILTER DROPDOWNS */}
        <div className="flex gap-2 mb-3 items-center">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="border border-gray-150 bg-white text-gray-800 text-[11px] font-bold px-2.5 py-1.5 rounded-xl outline-none focus:border-green-500 cursor-pointer"
          >
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="border border-gray-150 bg-white text-gray-800 text-[11px] font-bold px-2.5 py-1.5 rounded-xl outline-none focus:border-green-500 cursor-pointer"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i).reverse().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        
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
              <div key={tx._id} className="flex justify-between items-center text-xs border-b border-gray-50/50 pb-2 hover:translate-x-1 hover:bg-gray-50/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.01)] rounded-xl p-2 transition-all duration-200 group">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    tx.type === "INCOME" ? "bg-green-500" : tx.type === "EXPENSE" ? "bg-red-500" : "bg-blue-500"
                  }`} />
                  <div>
                    <h5 className="font-bold text-gray-950 leading-tight">
                      {tx.category}{" "}
                      <span className="text-[9px] font-medium text-gray-400">
                        ({linkedAccount ? linkedAccount.name : "Aset"})
                      </span>
                    </h5>
                    <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">
                      {tx.description || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-bold ${tx.type === "INCOME" ? "text-green-600" : tx.type === "EXPENSE" ? "text-red-500" : "text-blue-600"}`}>
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "⇄"} Rp {tx.amount.toLocaleString("id-ID")}
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
          {hasMoreTx && filteredTransactions.length > 0 && (
            <button
              onClick={() => {
                const nextPage = txPage + 1;
                setTxPage(nextPage);
                fetchHistoryTransactions(nextPage, true);
              }}
              className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-[10px] text-gray-500 font-bold hover:bg-gray-50 hover:text-gray-805 hover:border-gray-300 transition-all cursor-pointer text-center"
            >
              Muat Lebih Banyak
            </button>
          )}
          {filteredTransactions.length === 0 && <p className="text-center text-xs text-gray-400 italic pt-16">Tidak ditemukan catatan keuangan.</p>}
        </div>
      </div>
    );
  };

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

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: Card, Accounts, Limit Budget, Chart */}
        <div className="md:col-span-2 space-y-6 flex flex-col">
          
          {/* CARD TOTAL KEKAYAAN */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-green-950/10 relative overflow-hidden">
            {/* Ambient light effects in the card */}
            <div className="absolute right-0 bottom-0 opacity-15 pointer-events-none transform translate-x-12 translate-y-12">
              <svg width="220" height="220" viewBox="0 0 100 100" fill="currentColor">
                <circle cx="50" cy="50" r="50" />
              </svg>
            </div>

            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-xs opacity-75 uppercase tracking-wider font-bold">Total Aset Gabungan</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight">
                    {showBalance ? `Rp ${totalNetWorth.toLocaleString("id-ID")}` : "Rp ••••••••"}
                  </h1>
                  <button 
                    onClick={() => setShowBalance(!showBalance)} 
                    className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center"
                    title={showBalance ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
                  >
                    {showBalance ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {totalMonthlyInterest > 0 && (
                <div className="bg-red-500/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-red-500/30 text-right animate-pulse">
                  <p className="text-[9px] opacity-75 font-semibold uppercase tracking-wider">Bunga Bank Wajib / Bln</p>
                  <p className="text-xs font-extrabold text-red-100">Rp {totalMonthlyInterest.toLocaleString("id-ID")}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5 mt-6 relative z-10">
              <button onClick={() => { if(accounts.length > 0) { setTxAmount(""); setTxCategory(""); setTxDesc(""); setShowTxModal(true); } else alert("Tambahkan rekening bank terlebih dahulu!"); }} className="flex-1 min-w-[120px] bg-white text-emerald-950 font-bold py-2.5 px-3 rounded-xl text-xs hover:bg-emerald-50 transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-emerald-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Catat Manual
              </button>
              <button onClick={() => { if(accounts.length > 0) setShowOcrModal(true); else alert("Tambahkan rekening bank terlebih dahulu!"); }} className="flex-1 min-w-[120px] bg-emerald-800/80 text-white font-bold py-2.5 px-3 rounded-xl text-xs hover:bg-emerald-900 transition-all border border-emerald-700/50 shadow-sm cursor-pointer flex items-center justify-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                Scan Struk
              </button>
              <button onClick={() => setShowAccModal(true)} className="bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs hover:bg-emerald-500 transition-all border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1.5">
                <span>+ Akun</span>
              </button>
            </div>
          </div>

          {/* DOMPET & REKENING BERJALAN */}
          <div className="w-full">
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Dompet & Rekening Berjalan ({accounts.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map((acc) => (
                <div key={acc._id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-green-200 transition-all">
                  <div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold ${
                      acc.type === "BANK" ? "bg-blue-55 text-blue-600" :
                      acc.type === "INVESTMENT" ? "bg-purple-55 text-purple-600" : "bg-amber-55 text-amber-600"
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

          {/* FITUR LIMIT BUDGET BULANAN */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Limit Anggaran Bulanan</h3>
                <p className="text-xs text-gray-400 mt-0.5">Kontrol akumulasi pengeluaran harianmu</p>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setShowLimitModal(true)}
                  className="text-[10px] text-green-600 font-bold hover:underline cursor-pointer bg-green-50 py-1.5 px-2.5 rounded-lg border border-green-100"
                >
                  Batas Global
                </button>
                <button 
                  onClick={() => {
                    setEditingBudgetId(null);
                    setBudgetCategory("");
                    setBudgetLimit("");
                    setShowBudgetModal(true);
                  }}
                  className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer bg-emerald-50 py-1.5 px-2.5 rounded-lg border border-emerald-100"
                >
                  + Kategori
                </button>
              </div>
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

              {/* INDIKATOR PENGELUARAN PER MINGGU */}
              <div className="mt-4 pt-3.5 border-t border-gray-100">
                <div className="flex flex-wrap justify-between items-center mb-2.5 gap-2">
                  <div className="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                      Indikator Mingguan ({budgetMode === 'ADAPTIVE' ? 'Limit Adaptif' : 'Strict Flat 25%'})
                    </span>
                  </div>

                  {/* Mode Switcher Tabs */}
                  <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
                    <button 
                      type="button"
                      onClick={() => handleModeToggle('ADAPTIVE')}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        budgetMode === 'ADAPTIVE' 
                          ? "bg-white text-emerald-700 shadow-xs border border-gray-200" 
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                      title="Sisa budget dialokasikan ke minggu berikutnya"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-emerald-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      <span>Adaptif</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleModeToggle('STRICT')}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        budgetMode === 'STRICT' 
                          ? "bg-white text-gray-900 shadow-xs border border-gray-200" 
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                      title="Batas tiap minggu dikunci rata (25% per minggu)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-gray-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      <span>Strict Flat</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {weeklyBreakdown.map((w) => {
                    const target = w.targetLimit > 0 ? w.targetLimit : initialWeeklyLimit;
                    const pct = target > 0 ? Math.min((w.spent / target) * 100, 100) : 0;
                    const isOver = target > 0 && w.spent > target;
                    const isWarning = target > 0 && !isOver && (w.spent / target) >= 0.85;

                    return (
                      <div 
                        key={w.id}
                        className={`p-2.5 rounded-xl border transition-all relative overflow-hidden ${
                          w.isCurrent 
                            ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/10 shadow-xs" 
                            : "bg-gray-50/60 border-gray-100"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-bold text-gray-800 flex items-center gap-1">
                            {w.label}
                            {w.isCurrent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Minggu Berjalan" />
                            )}
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium">Tgl {w.range}</span>
                        </div>

                        <p className={`text-xs font-extrabold mt-0.5 ${isOver ? "text-red-500" : isWarning ? "text-amber-600" : "text-gray-900"}`}>
                          Rp {w.spent.toLocaleString("id-ID")}
                        </p>

                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[8px] text-gray-400 font-medium">
                            Limit: {target > 0 ? `Rp ${target.toLocaleString("id-ID")}` : "-"}
                          </span>
                          {!isStrict && target > initialWeeklyLimit && w.id >= currentWeekIndex && (
                            <span className="text-[7px] text-emerald-600 font-bold bg-emerald-100/60 px-1 rounded">
                              +Bonus
                            </span>
                          )}
                        </div>

                        {/* Progress Bar Mini */}
                        <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden mt-1">
                          <div
                            style={{ width: `${target > 0 ? pct : 0}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          />
                        </div>

                        {w.isCurrent && (
                          <span className="mt-1 block text-[8px] font-extrabold text-emerald-600 tracking-tight uppercase">
                            Minggu Ini
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* PROYEKSI PENGELUARAN AKHIR BULAN (Forecasting Card) */}
                {monthlyLimit > 0 && totalMonthlyExpense > 0 && (
                  <div className={`mt-3 p-3 rounded-2xl border transition-all ${
                    isProjectedOverLimit 
                      ? "bg-red-50/50 border-red-200 text-red-950" 
                      : "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-gray-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 0 5.814-5.518l2.74-1.22m0 0-3.976-1.536m3.976 1.536-1.536 3.976" />
                        </svg>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700">
                          Proyeksi Akhir Bulan (Forecasting)
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-gray-600 bg-white/90 px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                        Laju: Rp {dailyBurnRate.toLocaleString("id-ID")}/hari
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline mt-1.5">
                      <div>
                        <p className="text-xs font-black text-gray-900">
                          Estimasi Total: Rp {projectedMonthEndExpense.toLocaleString("id-ID")}
                        </p>
                        <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1">
                          {isProjectedOverLimit ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-red-500 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                              <span>Berpotensi melampaui limit bulanan sebesar <span className="font-extrabold">+Rp {projectionDiff.toLocaleString("id-ID")}</span></span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 text-emerald-600 flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                              </svg>
                              <span>Laju sangat baik! Diproyeksikan sisa/hemat <span className="font-extrabold">Rp {projectionDiff.toLocaleString("id-ID")}</span></span>
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-[9px] text-gray-400 font-semibold flex-shrink-0">
                        {daysPassed}/{daysInCurrentMonth} Hari Berlalu
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Budgets - Show ALL categories with spending */}
              {(() => {
                // Merge all categories: those with budgets AND those with spending
                const budgetMap: Record<string, BudgetType> = {};
                budgets.forEach(b => { budgetMap[getBudgetCategoryGroup(b.category)] = b; });

                const allCategories = new Set<string>([
                  ...Object.keys(categoryExpenses),
                  ...budgets.map(b => getBudgetCategoryGroup(b.category))
                ]);

                const categoryList = Array.from(allCategories)
                  .map(cat => ({
                    category: cat,
                    spent: categoryExpenses[cat] || 0,
                    budget: budgetMap[cat] || null,
                  }))
                  .sort((a, b) => b.spent - a.spent);

                if (categoryList.length === 0) return null;

                const categoryColorMap: Record<string, string> = {
                  "Makanan & Minuman": "#10b981",
                  "Transportasi": "#3b82f6",
                  "Belanja & Harian": "#f59e0b",
                  "Tagihan & Pulsa": "#ef4444",
                  "Kesehatan": "#06b6d4",
                  "Hiburan & Rekreasi": "#ec4899",
                  "Lainnya": "#9ca3af"
                };

                const totalSpent = categoryList.reduce((acc, curr) => acc + curr.spent, 0);
                const radius = 38;
                const circumference = 2 * Math.PI * radius; // ~238.76
                let accumulatedOffset = 0;

                return (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-4">Rincian Pengeluaran per Kategori</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      
                      {/* Left: SVG Doughnut Chart */}
                      <div className="flex flex-col items-center justify-center col-span-1 py-2">
                        <div className="relative w-32 h-32">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform select-none">
                            {/* Background Gray Circle */}
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#f3f4f6"
                              strokeWidth="8"
                            />
                            {/* Segments */}
                            {totalSpent > 0 && categoryList.map((item) => {
                              if (item.spent <= 0) return null;
                              const pct = item.spent / totalSpent;
                              const strokeLength = pct * circumference;
                              const strokeOffset = accumulatedOffset;
                              accumulatedOffset -= strokeLength;
                              const color = categoryColorMap[item.category] || "#9ca3af";
                              
                              return (
                                <circle
                                  key={item.category}
                                  cx="50"
                                  cy="50"
                                  r={radius}
                                  fill="transparent"
                                  stroke={color}
                                  strokeWidth="8"
                                  strokeDasharray={`${strokeLength} ${circumference}`}
                                  strokeDashoffset={strokeOffset}
                                  transform="rotate(-90 50 50)"
                                  className="transition-all duration-300 hover:stroke-[10px] cursor-pointer"
                                >
                                  <title>{`${item.category}: Rp ${item.spent.toLocaleString("id-ID")}`}</title>
                                </circle>
                              );
                            })}
                          </svg>
                          {/* Inner Label */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">Total</span>
                            <span className="text-[10px] font-black text-gray-950 mt-0.5">
                              {formatRupiahShort(totalSpent)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Legend and details list */}
                      <div className="col-span-2 space-y-3">
                        {categoryList.map(item => {
                          const hasLimit = item.budget !== null;
                          const limit = hasLimit ? item.budget!.limit : 0;
                          const pct = hasLimit ? Math.min((item.spent / limit) * 100, 100) : 0;
                          // For categories without limit, show a proportional bar relative to the highest spender
                          const maxSpent = categoryList.length > 0 ? categoryList[0].spent : 1;
                          const proportionalPct = maxSpent > 0 ? (item.spent / maxSpent) * 100 : 0;
                          const color = categoryColorMap[item.category] || "#9ca3af";

                          return (
                            <div key={item.category} className="space-y-1.5 group">
                              <div className="flex justify-between text-[11px] font-semibold items-center">
                                <span className="text-gray-700 flex items-center gap-1.5 font-bold">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  {item.category}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 font-medium">
                                    Rp {item.spent.toLocaleString("id-ID")}
                                    {hasLimit && (
                                      <span className="text-gray-400"> / Rp {limit.toLocaleString("id-ID")}</span>
                                    )}
                                  </span>
                                  
                                  {hasLimit && (
                                    <>
                                      {/* Edit Button */}
                                      <button
                                        onClick={() => {
                                          setEditingBudgetId(item.budget!._id);
                                          setBudgetCategory(item.budget!.category);
                                          setBudgetLimit(item.budget!.limit.toString());
                                          setShowBudgetModal(true);
                                        }}
                                        className="text-gray-400 hover:text-green-600 transition-all cursor-pointer p-0.5 rounded hover:bg-gray-50"
                                        title="Edit Limit Kategori"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                      </button>

                                      {/* Delete Button */}
                                      <button
                                        onClick={() => handleDeleteBudget(item.budget!._id)}
                                        className="text-gray-400 hover:text-red-500 transition-all cursor-pointer p-0.5 rounded hover:bg-gray-50"
                                        title="Hapus Limit Kategori"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="w-full h-1.5 bg-gray-55 rounded-full overflow-hidden">
                                {hasLimit ? (
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      pct >= 95 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-600"
                                    }`}
                                  />
                                ) : (
                                  <div
                                    style={{ width: `${proportionalPct}%` }}
                                    className="h-full rounded-full transition-all duration-300 bg-blue-400"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* RIWAYAT MUTASI (MOBILE ONLY) */}
          <div className="block md:hidden">
            {renderTransactionHistory("h-[400px]")}
          </div>

          {/* CHART HISTORY KEUANGAN */}
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Laporan Keuangan Bulanan</h3>
                <p className="text-xs text-gray-400 mt-0.5">Riwayat keuangan untuk memantau arus kas & aset Anda</p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Tabs */}
                <div className="flex bg-gray-55 p-1 rounded-xl border border-gray-100 gap-1">
                  <button
                    onClick={() => { setActiveChartTab('flow'); setHoveredIndex(null); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      activeChartTab === 'flow' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Arus Kas
                  </button>
                  <button
                    onClick={() => { setActiveChartTab('assets'); setHoveredIndex(null); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      activeChartTab === 'assets' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Total Aset
                  </button>
                </div>

                {/* Year Filter */}
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(Number(e.target.value)); setHoveredIndex(null); }}
                  className="border border-gray-200 bg-white text-gray-800 text-xs font-semibold px-2 py-1.5 rounded-xl outline-none focus:border-green-500 cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="relative w-full overflow-visible select-none" onClick={() => setHoveredIndex(null)}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
                <defs>
                  <linearGradient id="assetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35"/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines & Y Axis Labels */}
                {[0, 0.33, 0.66, 1].map((ratio, index) => {
                  const valFlow = yMaxFlow * ratio;
                  const valAsset = yMaxAsset * ratio;
                  const y = (svgHeight - paddingBottom) - ratio * chartHeight;
                  return (
                    <g key={index} className="opacity-70">
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={svgWidth - paddingRight}
                        y2={y}
                        stroke="#f3f4f6"
                        strokeWidth={1}
                        strokeDasharray={ratio === 0 ? "none" : "3 3"}
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="text-[9px] fill-gray-400 font-semibold font-mono"
                      >
                        {formatRupiahShort(activeChartTab === 'flow' ? valFlow : valAsset)}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Month Labels */}
                {monthNames.map((month, index) => {
                  const x = activeChartTab === 'flow' ? getXBar(index) : getX(index);
                  const isHovered = hoveredIndex === index;
                  return (
                    <text
                      key={index}
                      x={x}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className={`text-[9px] transition-all ${
                        isHovered 
                          ? activeChartTab === 'flow'
                            ? 'fill-emerald-600 font-black'
                            : 'fill-blue-600 font-black'
                          : 'fill-gray-400 font-bold'
                      }`}
                      style={{
                        fontSize: isHovered ? '10px' : '9px'
                      }}
                    >
                      {month}
                    </text>
                  );
                })}

                {/* Hover line indicator */}
                {hoveredIndex !== null && (
                  <line
                    x1={activeChartTab === 'flow' ? getXBar(hoveredIndex) : getX(hoveredIndex)}
                    y1={paddingTop}
                    x2={activeChartTab === 'flow' ? getXBar(hoveredIndex) : getX(hoveredIndex)}
                    y2={svgHeight - paddingBottom}
                    stroke="#e5e7eb"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                )}

                {/* Render Flow Bars */}
                {activeChartTab === 'flow' && (
                  <g>
                    {/* Income & Expense Bars */}
                    {monthlyIncome.map((inc, i) => {
                      const exp = monthlyExpense[i];
                      const xBar = getXBar(i);
                      const yInc = getYFlow(inc);
                      const yExp = getYFlow(exp);
                      const hInc = Math.max(0, svgHeight - paddingBottom - yInc);
                      const hExp = Math.max(0, svgHeight - paddingBottom - yExp);

                      return (
                        <g key={i}>
                          {/* Income Bar */}
                          {inc > 0 && (
                            <rect
                              x={xBar - 7}
                              y={yInc}
                              width={6}
                              height={hInc}
                              rx={1.5}
                              fill="#10b981"
                              className="transition-all duration-300 hover:opacity-90"
                            />
                          )}
                          {/* Expense Bar */}
                          {exp > 0 && (
                            <rect
                              x={xBar + 1}
                              y={yExp}
                              width={6}
                              height={hExp}
                              rx={1.5}
                              fill="#f43f5e"
                              className="transition-all duration-300 hover:opacity-90"
                            />
                          )}
                          {/* Invisible hover area for tooltip */}
                          <rect
                            x={xBar - (chartWidth / 24)}
                            y={paddingTop}
                            width={chartWidth / 12}
                            height={chartHeight}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              if (window.matchMedia('(hover: hover)').matches) setHoveredIndex(i);
                            }}
                            onMouseLeave={() => {
                              if (window.matchMedia('(hover: hover)').matches) setHoveredIndex(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHoveredIndex(prev => prev === i ? null : i);
                            }}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Render Asset Line & Area */}
                {activeChartTab === 'assets' && (
                  <g>
                    {/* Area under the line */}
                    <path
                      d={assetAreaD}
                      fill="url(#assetGradient)"
                      className="transition-all duration-500"
                    />
                    {/* Line path */}
                    <path
                      d={assetPathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-500"
                    />
                    {/* Dots at months */}
                    {monthlyAssets.map((asset, i) => {
                      const x = getX(i);
                      const y = getYAsset(asset);
                      return (
                        <g key={i}>
                          <circle
                            cx={x}
                            cy={y}
                            r={hoveredIndex === i ? 5 : 3.5}
                            fill={hoveredIndex === i ? "#3b82f6" : "#ffffff"}
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            className="transition-all duration-200 cursor-pointer"
                          />
                          {/* Invisible hover area */}
                          <rect
                            x={x - (chartWidth / 22)}
                            y={paddingTop}
                            width={chartWidth / 11}
                            height={chartHeight}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => {
                              if (window.matchMedia('(hover: hover)').matches) setHoveredIndex(i);
                            }}
                            onMouseLeave={() => {
                              if (window.matchMedia('(hover: hover)').matches) setHoveredIndex(null);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHoveredIndex(prev => prev === i ? null : i);
                            }}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredIndex !== null && (
                <div
                  className="absolute bg-white/95 backdrop-blur-md border border-gray-100 shadow-xl rounded-2xl p-3 text-xs pointer-events-none z-10 transition-all duration-100 ease-out"
                  style={{
                    left: `${activeChartTab === 'flow' ? getXBar(hoveredIndex) / 600 * 100 : getX(hoveredIndex) / 600 * 100}%`,
                    top: '15px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <p className="font-extrabold text-gray-900 mb-1 text-[11px]">{monthNames[hoveredIndex]} {selectedYear}</p>
                  {activeChartTab === 'flow' ? (
                    <div className="space-y-1 text-[10px]">
                      <p className="text-green-600 font-bold flex items-center justify-between gap-4">
                        <span>Pemasukan:</span>
                        <span>Rp {monthlyIncome[hoveredIndex].toLocaleString("id-ID")}</span>
                      </p>
                      <p className="text-red-500 font-bold flex items-center justify-between gap-4">
                        <span>Pengeluaran:</span>
                        <span>Rp {monthlyExpense[hoveredIndex].toLocaleString("id-ID")}</span>
                      </p>
                      <div className="border-t border-gray-100 my-1 pt-1" />
                      <p className={`${monthlyIncome[hoveredIndex] - monthlyExpense[hoveredIndex] >= 0 ? "text-green-700" : "text-red-600"} font-black flex items-center justify-between gap-4`}>
                        <span>Netto:</span>
                        <span>Rp {(monthlyIncome[hoveredIndex] - monthlyExpense[hoveredIndex]).toLocaleString("id-ID")}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[10px]">
                      <p className="text-blue-600 font-black flex items-center justify-between gap-4">
                        <span>Total Aset:</span>
                        <span>Rp {monthlyAssets[hoveredIndex].toLocaleString("id-ID")}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Legend Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-50 text-[10px] font-bold text-gray-500">
              {activeChartTab === 'flow' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-green-600 rounded-sm" />
                    <span>Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" />
                    <span>Pengeluaran</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
                  <span>Total Aset Gabungan</span>
                </div>
              )}
            </div>

            {/* Dynamic Insights Panel */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 mb-2.5">
                <span>Wawasan Keuangan</span>
              </h4>
              <div className="space-y-2">
                {getDynamicInsights().map((insight, idx) => (
                  <div key={idx} className="bg-emerald-50/45 border border-emerald-100/50 rounded-xl p-3 flex gap-2.5 items-start text-xs text-emerald-950 font-semibold leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Riwayat Transaksi (Desktop), Tagihan, Target Tabungan */}
        <div className="md:col-span-1 space-y-6 flex flex-col">
          
          {/* RIWAYAT MUTASI (DESKTOP ONLY) */}
          <div className="hidden md:block">
            {renderTransactionHistory("h-[550px]")}
          </div>

          {/* TAGIHAN & LANGGANAN */}
          <div className="w-full">
            {bills.length === 0 ? (
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 19.462A9 9 0 1121.75 12a9 9 0 01-9 9z" />
                  </svg>
                  <span className="font-semibold text-gray-400">Belum ada tagihan</span>
                </div>
                <button
                  onClick={() => {
                    if(accounts.length > 0) setShowBillModal(true);
                    else alert("Tambahkan rekening bank terlebih dahulu!");
                  }}
                  className="text-[10px] text-green-600 font-extrabold bg-green-50 hover:bg-green-100 py-1.5 px-3 rounded-lg border border-green-100 cursor-pointer"
                >
                  + Tagihan
                </button>
              </div>
            ) : (
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      Tagihan & Langganan
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Pantau pengeluaran bulanan rutin Anda ({bills.length})</p>
                  </div>
                  <button
                    onClick={() => {
                      if(accounts.length > 0) setShowBillModal(true);
                      else alert("Tambahkan rekening bank terlebih dahulu!");
                    }}
                    className="text-[10px] text-green-600 font-bold bg-green-50 hover:bg-green-100 py-1.5 px-3 rounded-lg border border-green-100 cursor-pointer"
                  >
                    + Tagihan
                  </button>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[260px] pr-1">
                  {bills.map((bill) => {
                    const linkedAccount = accounts.find(a => a._id === bill.accountId);
                    const today = new Date();
                    const currentDay = today.getDate();
                    const daysLeft = bill.dueDate - currentDay;
                    const isUrgent = bill.status === "UNPAID" && daysLeft >= 0 && daysLeft <= 3;

                    return (
                      <div 
                        key={bill._id} 
                        className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 relative group ${
                          bill.status === "PAID" 
                            ? "bg-gray-50/50 border-gray-100 opacity-70" 
                            : isUrgent 
                              ? "bg-red-50/50 border-red-200 animate-pulse" 
                              : "bg-white border-gray-100 hover:border-green-200"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 text-xs">{bill.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                bill.status === "PAID" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                              }`}>
                                {bill.status === "PAID" ? "Lunas" : "Belum Bayar"}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{bill.category} • Rekening: {linkedAccount?.name || "-"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-extrabold text-xs text-gray-900">Rp {bill.amount.toLocaleString("id-ID")}</p>
                            <p className={`text-[10px] mt-0.5 font-bold ${
                              bill.status === "PAID" 
                                ? "text-gray-400" 
                                : isUrgent 
                                  ? "text-red-500" 
                                  : "text-gray-500"
                            }`}>
                              Jatuh Tempo: Tgl {bill.dueDate}
                              {bill.status === "UNPAID" && (
                                daysLeft === 0 ? " (Hari Ini)" : daysLeft > 0 ? ` (${daysLeft} hari lagi)` : " (Lewat Tempo)"
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1.5 border-t border-gray-100/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteBill(bill._id)}
                            className="text-[10px] text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                          >
                            Hapus
                          </button>
                          {bill.status === "UNPAID" && (
                            <button
                              onClick={() => handlePayBill(bill._id)}
                              className="text-[10px] bg-green-600 hover:bg-green-600 text-white px-3 py-1 rounded-lg font-bold transition-all shadow-sm cursor-pointer"
                            >
                              Bayar Sekarang
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* TARGET TABUNGAN (SAVINGS GOALS) */}
          <div className="w-full">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  Target Tabungan & Mimpi ({savings.length})
                </h3>
                <button
                  onClick={() => setShowSavingsModal(true)}
                  className="text-[10px] text-green-600 font-bold bg-green-50 hover:bg-green-100 py-1.5 px-3 rounded-lg border border-green-100 cursor-pointer"
                >
                  + Target Baru
                </button>
              </div>
              
              <div className="space-y-4">
                {savings.map((goal) => {
                  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                  
                  // Helper to estimate
                  const getGoalEstimation = (g: SavingsGoalType) => {
                    if (g.currentAmount >= g.targetAmount) return "Tercapai! 🎉";
                    const remaining = g.targetAmount - g.currentAmount;
                    
                    if (g.monthlyContribution && g.monthlyContribution > 0) {
                      const months = Math.ceil(remaining / g.monthlyContribution);
                      return `Estimasi: ${months} bulan lagi (Rp ${g.monthlyContribution.toLocaleString("id-ID")}/bln)`;
                    }

                    const defaultAllocatedRate = 250000;
                    const months = Math.ceil(remaining / defaultAllocatedRate);
                    return `Estimasi: ${months} bln (berdasarkan tren Rp 250rb/bln)`;
                  };

                  return (
                    <div key={goal._id} className="p-3.5 rounded-2xl border border-gray-150 bg-gray-50/25 flex flex-col justify-between group hover:border-green-200 transition-all">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-extrabold text-gray-900 text-sm leading-snug">{goal.name}</h4>
                          <button
                            onClick={() => handleDeleteSavingsGoal(goal._id)}
                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-xs p-0.5"
                            title="Hapus Target"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="flex justify-between text-[11px] font-bold text-gray-500 mt-2 mb-1">
                          <span>Progress: {pct.toFixed(0)}%</span>
                          <span className="text-gray-900 font-extrabold text-[11px]">
                            Rp {goal.currentAmount.toLocaleString("id-ID")}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 100 ? "bg-green-600" : pct >= 50 ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                        </div>

                        <div className="flex justify-between items-center mt-2.5">
                          <p className="text-[9px] text-gray-400 font-medium">
                            {getGoalEstimation(goal)}
                          </p>
                          <button
                            onClick={() => {
                              setSelectedSavingId(goal._id);
                              setAddFundsValue("");
                              setShowAddFundsModal(true);
                            }}
                            className="text-[9px] font-bold text-green-600 bg-green-50 hover:bg-green-100 py-1 px-2 rounded-lg border border-green-100 transition-all cursor-pointer"
                          >
                            + Tabung
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {savings.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-400 italic bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    Belum ada target tabungan dibuat.
                  </div>
                )}
              </div>
            </div>
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
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Mode Pengalokasian Mingguan</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button 
                    type="button" 
                    onClick={() => setBudgetMode('ADAPTIVE')}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      budgetMode === 'ADAPTIVE' 
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold" 
                        : "bg-gray-50 border-gray-100 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      <span>Adaptif</span>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5 font-normal">Sisa budget otomatis dialokasikan ke minggu berikutnya</p>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setBudgetMode('STRICT')}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      budgetMode === 'STRICT' 
                        ? "bg-gray-900 border-gray-900 text-white font-bold" 
                        : "bg-gray-50 border-gray-100 text-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-3.5 h-3.5 ${budgetMode === 'STRICT' ? 'text-white' : 'text-gray-600'}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      <span>Strict Flat</span>
                    </div>
                    <p className={`text-[9px] mt-0.5 font-normal ${budgetMode === 'STRICT' ? 'text-gray-300' : 'text-gray-500'}`}>Batas tiap minggu dikunci rata (25% per minggu)</p>
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowLimitModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Simpan Batas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH TAGIHAN BERULANG */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-base mb-4">Tambah Tagihan Berulang</h3>
            <form onSubmit={handleAddBill} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nama Tagihan</label>
                <input required type="text" placeholder="Contoh: Netflix, Wifi Rumah, BPJS" value={billName} onChange={e => setBillName(e.target.value)} className="w-full border p-2.5 rounded-lg focus:outline-none focus:border-green-500 text-black text-xs font-semibold" />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal Tagihan (Rp)</label>
                <input required type="number" placeholder="0" value={billAmount} onChange={e => setBillAmount(e.target.value)} className="w-full border p-2.5 rounded-lg focus:outline-none focus:border-green-500 text-black text-xs font-semibold" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Kategori</label>
                  <select value={billCategory} onChange={e => setBillCategory(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-semibold">
                    <option value="Tagihan & Pulsa">Tagihan & Pulsa</option>
                    <option value="Hiburan & Rekreasi">Hiburan & Rekreasi</option>
                    <option value="Kesehatan">Kesehatan</option>
                    <option value="Transportasi">Transportasi</option>
                    <option value="Belanja & Harian">Belanja & Harian</option>
                    <option value="Makanan & Minuman">Makanan & Minuman</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Tanggal Jatuh Tempo</label>
                  <select value={billDueDate} onChange={e => setBillDueDate(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-mono font-bold">
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Tgl {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Rekening Pembayaran Default</label>
                <select value={billAccount} onChange={e => setBillAccount(e.target.value)} className="w-full border p-2.5 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-semibold">
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.name} (Rp {a.balance.toLocaleString("id-ID")})</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowBillModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Simpan Tagihan</button>
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
                <label className="block mb-1 font-semibold text-gray-600">
                  {txType === "TRANSFER" ? "Rekening Asal" : "Pilih Rekening"}
                </label>
                <select 
                  value={txAccount} 
                  onChange={e => {
                    const val = e.target.value;
                    setTxAccount(val);
                    if (val === txToAccount) {
                      const other = accounts.find(a => a._id !== val);
                      if (other) setTxToAccount(other._id);
                    }
                  }} 
                  className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-semibold"
                >
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.name} (Rp {a.balance.toLocaleString("id-ID")})</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Jenis Aktivitas</label>
                <select value={txType} onChange={e => { setTxType(e.target.value); if(e.target.value === "TRANSFER" && accounts.length > 1) { const other = accounts.find(a => a._id !== txAccount); if(other) setTxToAccount(other._id); } }} className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-bold">
                  <option value="EXPENSE">PENGELUARAN (-)</option>
                  <option value="INCOME">PEMASUKAN (+)</option>
                  <option value="TRANSFER">TRANSFER (PINDAH SALDO)</option>
                </select>
              </div>

              {txType === "TRANSFER" && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block mb-1 font-semibold text-gray-600">Rekening Tujuan</label>
                  <select value={txToAccount} onChange={e => setTxToAccount(e.target.value)} className="w-full border p-2 rounded-lg bg-white text-black focus:outline-none focus:border-green-500 font-semibold">
                    {accounts.filter(a => a._id !== txAccount).map(a => (
                      <option key={a._id} value={a._id}>{a.name} (Rp {a.balance.toLocaleString("id-ID")})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal (Rp)</label>
                <input required type="number" placeholder="0" value={txAmount} onChange={e => setTxAmount(e.target.value)} className="w-full border p-2.5 rounded-lg focus:outline-none focus:border-green-500 text-black font-extrabold text-sm" />
              </div>



              {txType !== "TRANSFER" && (
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Keterangan</label>
                  <input required type="text" placeholder="Contoh: Makan siang bakso, Bensin motor, Bayar listrik" value={txDesc} onChange={e => setTxDesc(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black text-xs font-semibold" />
                  {txDesc && (
                    <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                      {aiCategoryLoading ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                          <span className="animate-pulse">Mengonfirmasi ulang dengan AI...</span>
                        </>
                      ) : (
                        <>
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            getBudgetCategoryGroup(txDesc) !== "Lainnya" ? "bg-blue-400" 
                            : aiCategory && aiCategory !== "Lainnya" ? "bg-emerald-400" 
                            : "bg-gray-400"
                          }`}></span>
                          Kategori{getBudgetCategoryGroup(txDesc) === "Lainnya" && aiCategory && aiCategory !== "Lainnya" ? " (AI)" : ""}: <span className="font-bold text-gray-600">{resolveCategory(txDesc)}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
              {txType === "TRANSFER" && (
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Keterangan (Opsional)</label>
                  <input type="text" placeholder="Opsional" value={txDesc} onChange={e => setTxDesc(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black text-xs font-semibold" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowTxModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer text-gray-700">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Rekam Transaksi</button>
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
                      src={ocrImageSrc || undefined} 
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
                      <select 
                        required 
                        value={ocrCategory} 
                        onChange={e => setOcrCategory(e.target.value)} 
                        className="w-full border p-2.5 rounded-xl text-xs bg-white text-black focus:outline-none focus:border-green-500 font-semibold" 
                      >
                        <option value="Makanan & Minuman">Makanan & Minuman</option>
                        <option value="Transportasi">Transportasi</option>
                        <option value="Belanja & Harian">Belanja & Harian</option>
                        <option value="Tagihan & Pulsa">Tagihan & Pulsa</option>
                        <option value="Kesehatan">Kesehatan</option>
                        <option value="Hiburan & Rekreasi">Hiburan & Rekreasi</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
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

      {/* MODAL: CONFIG ANGGARAN KATEGORI */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in duration-200">
            <h3 className="font-bold text-base mb-2">{editingBudgetId ? "Edit Limit Kategori" : "Limit Kategori"}</h3>
            <p className="text-xs text-gray-400 mb-4">Batasi anggaran belanja untuk kategori spesifik agar keuangan tetap sehat.</p>
            <form onSubmit={handleAddBudget} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Pilih Kategori</label>
                <select required value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)} className="w-full border p-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-green-500 text-black bg-white">
                  <option value="" disabled>— Pilih Kategori —</option>
                  <option value="Makanan & Minuman">Makanan & Minuman</option>
                  <option value="Transportasi">Transportasi</option>
                  <option value="Belanja & Harian">Belanja & Harian</option>
                  <option value="Tagihan & Pulsa">Tagihan & Pulsa</option>
                  <option value="Kesehatan">Kesehatan</option>
                  <option value="Hiburan & Rekreasi">Hiburan & Rekreasi</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Batas Anggaran Bulanan (Rp)</label>
                <input required type="number" placeholder="Nominal Rp" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowBudgetModal(false); setEditingBudgetId(null); }} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer text-gray-700">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">{editingBudgetId ? "Simpan Perubahan" : "Simpan Anggaran"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH TARGET TABUNGAN */}
      {showSavingsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl animate-in fade-in duration-200">
            <h3 className="font-bold text-base mb-2">Target Tabungan Baru</h3>
            <p className="text-xs text-gray-400 mb-4">Buat target pencapaian mimpi finansialmu.</p>
            <form onSubmit={handleAddSavingsGoal} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nama Target Mimpi</label>
                <input required type="text" placeholder="Contoh: Laptop Kerja, Dana Darurat, Liburan" value={savingName} onChange={e => setSavingName(e.target.value)} className="w-full border p-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Nominal Target (Rp)</label>
                <input required type="number" placeholder="Nominal target akhir" value={savingTarget} onChange={e => setSavingTarget(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Tabungan Awal (Rp)</label>
                  <input type="number" placeholder="0" value={savingCurrent} onChange={e => setSavingCurrent(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black font-semibold" />
                </div>
                <div>
                  <label className="block mb-1 font-semibold text-gray-600">Rencana Nabung / Bln (Rp)</label>
                  <input type="number" placeholder="Opsional" value={savingMonthly} onChange={e => setSavingMonthly(e.target.value)} className="w-full border p-2 rounded-lg focus:outline-none focus:border-green-500 text-black font-semibold" />
                </div>
              </div>
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Target Tanggal Tercapai (Opsional)</label>
                <input type="date" value={savingDate} onChange={e => setSavingDate(e.target.value)} className="w-full border p-2.5 rounded-lg focus:outline-none focus:border-green-500 text-black font-semibold" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSavingsModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer text-gray-700">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Simpan Target</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH SALDO/DANA TABUNGAN */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm grid place-items-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xs shadow-xl animate-in fade-in duration-200">
            <h3 className="font-bold text-sm mb-1">Tabung Uang</h3>
            <p className="text-[11px] text-gray-400 mb-4">Tambahkan dana ke tabungan impianmu.</p>
            <form onSubmit={handleAddSavingsFunds} className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 font-semibold text-gray-600">Jumlah Dana Ditabung (Rp)</label>
                <input required type="number" placeholder="0" value={addFundsValue} onChange={e => setAddFundsValue(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-bold text-green-600 focus:outline-none focus:border-green-500 text-black" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAddFundsModal(false)} className="flex-1 bg-gray-100 py-2.5 rounded-lg font-bold cursor-pointer text-gray-700">Batal</button>
                <button type="submit" className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-bold cursor-pointer">Tabung</button>
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