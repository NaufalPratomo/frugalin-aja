import Account from "./models/Account";
import Transaction from "./models/Transaction";
import AccountSnapshot from "./models/AccountSnapshot";

const TYPES = ["BANK", "CASH", "INVESTMENT"];

const monthKey = (y, m) => {
  // m boleh -1 (Desember tahun sebelumnya)
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Hapus snapshot mulai bulan dari `fromDate` (atau semuanya jika null). */
export async function invalidateSnapshots(userId, fromDate = null) {
  const filter = { userId };
  if (fromDate) {
    const d = new Date(fromDate);
    if (!isNaN(d.getTime())) filter.month = { $gte: monthKey(d.getFullYear(), d.getMonth()) };
  }
  await AccountSnapshot.deleteMany(filter);
}

/** Efek sebuah transaksi pada saldo: [{accountId, delta}] */
export function balanceEffects(tx) {
  const amount = Number(tx.amount) || 0;
  switch (tx.type) {
    case "INCOME":
      return [{ accountId: String(tx.accountId), delta: amount }];
    case "EXPENSE":
      return [{ accountId: String(tx.accountId), delta: -amount }];
    case "ADJUSTMENT":
      return [{ accountId: String(tx.accountId), delta: amount }];
    case "TRANSFER": {
      const out = [{ accountId: String(tx.accountId), delta: -amount }];
      if (tx.toAccountId) out.push({ accountId: String(tx.toAccountId), delta: amount });
      return out;
    }
    default:
      return [];
  }
}

export async function applyEffects(effects, userId) {
  for (const e of effects) {
    await Account.updateOne({ _id: e.accountId, userId }, { $inc: { balance: e.delta } });
  }
}

/**
 * Laporan Total Aset per akhir bulan untuk satu tahun.
 * Bulan lampau: dari snapshot, atau direkonstruksi mundur dari saldo sekarang lalu disimpan.
 * Bulan berjalan: saldo live. Bulan setelahnya: null (belum terjadi).
 */
export async function buildAssetReport(userId, year) {
  const accounts = await Account.find({ userId }).lean();
  const byId = new Map(accounts.map((a) => [String(a._id), a]));
  const now = new Date();
  const nowTime = now.getTime();

  const current = {};
  for (const a of accounts) current[String(a._id)] = Math.round(Number(a.balance) || 0);

  // index -1 = akhir Desember tahun sebelumnya (untuk menghitung selisih Januari)
  const idxs = [];
  for (let m = -1; m <= 11; m++) idxs.push(m);
  const endOf = (m) => new Date(year, m + 1, 0, 23, 59, 59, 999);

  const pastIdxs = idxs.filter((m) => endOf(m).getTime() < nowTime);
  const snaps = await AccountSnapshot.find({
    userId,
    month: { $in: pastIdxs.map((m) => monthKey(year, m)) }
  }).lean();
  const snapByMonth = new Map(snaps.map((s) => [s.month, s]));

  const balancesByIdx = {}; // m -> {accountId: saldo}
  const missing = pastIdxs.filter((m) => !snapByMonth.has(monthKey(year, m)));

  // Rekonstruksi hanya jika ada bulan lampau tanpa snapshot
  const rebuilt = {};
  if (missing.length > 0) {
    const txs = await Transaction.find({ userId, date: { $gte: new Date(year, 0, 1) } })
      .select("type amount accountId toAccountId date")
      .sort({ date: -1 })
      .lean();

    const running = { ...current };
    let i = 0;
    for (let m = 11; m >= -1; m--) {
      const end = endOf(m).getTime();
      if (end >= nowTime) continue; // bulan berjalan / masa depan: saldo live
      while (i < txs.length && new Date(txs[i].date).getTime() > end) {
        for (const e of balanceEffects(txs[i])) {
          if (running[e.accountId] !== undefined) running[e.accountId] -= e.delta; // balik efeknya
        }
        i++;
      }
      rebuilt[m] = { ...running };
    }

    const toSave = missing.filter((m) => rebuilt[m]);
    if (toSave.length > 0) {
      await AccountSnapshot.bulkWrite(
        toSave.map((m) => ({
          updateOne: {
            filter: { userId, month: monthKey(year, m) },
            update: { $set: { balances: rebuilt[m] } },
            upsert: true
          }
        }))
      ).catch(() => {}); // cache saja; gagal simpan tidak boleh merusak laporan
    }
  }

  for (const m of idxs) {
    const end = endOf(m).getTime();
    if (end < nowTime) {
      const snap = snapByMonth.get(monthKey(year, m));
      balancesByIdx[m] = snap ? Object.fromEntries(Object.entries(snap.balances || {})) : rebuilt[m];
    } else if (new Date(year, m, 1).getTime() <= nowTime) {
      balancesByIdx[m] = current; // bulan berjalan
    } else {
      balancesByIdx[m] = null;
    }
  }

  const summarize = (balances) => {
    if (!balances) return null;
    const byType = { BANK: 0, CASH: 0, INVESTMENT: 0 };
    const rows = [];
    let total = 0;
    for (const [id, bal] of Object.entries(balances)) {
      const acc = byId.get(id);
      if (!acc) continue;
      const b = Math.round(bal);
      total += b;
      byType[acc.type] += b;
      rows.push({ id, name: acc.name, type: acc.type, balance: b });
    }
    return { total, byType, accounts: rows };
  };

  const prevYearEnd = summarize(balancesByIdx[-1]);
  let prevTotal = prevYearEnd ? prevYearEnd.total : null;

  const months = [];
  for (let m = 0; m < 12; m++) {
    const s = summarize(balancesByIdx[m]);
    if (!s) {
      months.push({ month: m, future: true, total: null, byType: null, accounts: [], delta: null });
      continue;
    }
    const isCurrent = endOf(m).getTime() >= nowTime;
    months.push({
      month: m,
      future: false,
      isCurrent,
      total: s.total,
      byType: s.byType,
      accounts: s.accounts,
      delta: prevTotal === null ? null : s.total - prevTotal
    });
    prevTotal = s.total;
  }

  const live = summarize(current);
  return { year, types: TYPES, months, current: { total: live.total, byType: live.byType } };
}
