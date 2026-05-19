import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }, // Terhubung ke bank/cash mana
  type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true }, // Pemasukan atau Pengeluaran
  amount: { type: Number, required: true },
  category: { type: String, required: true }, // Contoh: "Gaji", "Makanan", "Pengeluaran Harian"
  description: { type: String },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);