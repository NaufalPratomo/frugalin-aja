import mongoose from 'mongoose';

const BillSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // Contoh: "Netflix", "Spotify", "Listrik"
  amount: { type: Number, required: true },
  category: { type: String, required: true }, // Contoh: "Tagihan & Pulsa", "Hiburan & Rekreasi"
  dueDate: { type: Number, required: true, min: 1, max: 31 }, // Tanggal jatuh tempo bulanan (1-31)
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }, // Rekening default pembayaran
  status: { type: String, enum: ['UNPAID', 'PAID'], default: 'UNPAID' },
  lastPaidDate: { type: Date }
}, { timestamps: true });

if (process.env.NODE_ENV === 'development' && mongoose.models.Bill) {
  delete mongoose.models.Bill;
}

export default mongoose.models.Bill || mongoose.model('Bill', BillSchema);
