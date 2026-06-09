import dbConnect from "../../../../lib/mongodb";
import Transaction from "../../../../lib/models/Transaction";
import Account from "../../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    // 1. Cari transaksi yang ingin dihapus
    const transaction = await Transaction.findOne({ _id: id, userId: session.user.id });
    if (!transaction) {
      return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    // 2. Cari akun terkait dan kembalikan saldonya
    const account = await Account.findById(transaction.accountId);
    const transactionAmount = Number(transaction.amount);

    if (transaction.type === "TRANSFER") {
      if (account) {
        account.balance += transactionAmount; // Tambah kembali ke rekening asal
        await account.save();
      }
      if (transaction.toAccountId) {
        const destAccount = await Account.findById(transaction.toAccountId);
        if (destAccount) {
          destAccount.balance -= transactionAmount; // Kurangi dari rekening tujuan
          await destAccount.save();
        }
      }
    } else {
      if (account) {
        if (transaction.type === "INCOME") {
          account.balance -= transactionAmount;
        } else if (transaction.type === "EXPENSE") {
          account.balance += transactionAmount;
        }
        await account.save();
      }
    }

    // 4. Hapus transaksi dari database
    await Transaction.deleteOne({ _id: id });

    return NextResponse.json({ message: "Transaksi berhasil dihapus" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}
