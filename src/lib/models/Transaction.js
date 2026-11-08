import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }, // Terhubung ke bank/cash mana
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }, // Rekening tujuan jika tipe TRANSFER
  // ADJUSTMENT = koreksi saldo manual; amount bertanda (+ menambah, - mengurangi saldo)
  type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true }, // Contoh: "Gaji", "Makanan", "Pengeluaran Harian"
  description: { type: String },
  date: { type: Date, default: Date.now },
  // Kunci idempotensi untuk transaksi otomatis (mis. bunga bulanan). Unik jika terisi.
  recurringKey: { type: String }
}, { timestamps: true });

TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ recurringKey: 1 }, { unique: true, sparse: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.Transaction) {
  delete mongoose.models.Transaction;
}

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
