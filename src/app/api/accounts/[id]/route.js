import dbConnect from "../../../../lib/mongodb";
import Account from "../../../../lib/models/Account";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const { balance } = await req.json();

    if (balance === undefined) {
      return NextResponse.json({ message: "Saldo baru wajib diisi" }, { status: 400 });
    }

    await dbConnect();
    
    // Cari akun dan pastikan milik user yang sedang login
    const account = await Account.findOneAndUpdate(
      { _id: id, userId: session.user.id },
      { balance: Number(balance) },
      { new: true } // kembalikan data terbaru setelah di-update
    );

    if (!account) {
      return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(account, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}