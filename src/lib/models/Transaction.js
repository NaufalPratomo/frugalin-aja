import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }, // Terhubung ke bank/cash mana
  toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }, // Rekening tujuan jika tipe TRANSFER
  type: { type: String, enum: ['INCOME', 'EXPENSE', 'TRANSFER'], required: true }, // Pemasukan, Pengeluaran, atau Transfer
  amount: { type: Number, required: true },
  category: { type: String, required: true }, // Contoh: "Gaji", "Makanan", "Pengeluaran Harian"
  description: { type: String },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.Transaction) {
  delete mongoose.models.Transaction;
}

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);