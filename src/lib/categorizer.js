/**
 * Sistem Pengkategorian Transaksi Cerdas Frugalin.aja
 * Menggunakan pencocokan kata kunci komprehensif khas Indonesia (sub-millisecond)
 * sebagai lini pertama, dengan fallback cerdas ke AI (Gemini).
 */

export const CATEGORIES = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja & Harian",
  "Tagihan & Pulsa",
  "Kesehatan",
  "Hiburan & Rekreasi",
  "Lainnya",
];

export const INCOME_CATEGORIES = [
  "Gaji & Pendapatan",
  "Bonus & Tunjangan",
  "Bisnis & Penjualan",
  "Investasi & Dividen",
  "Hadiah & Cashback",
  "Pemasukan Lainnya",
];

export function getIncomeCategoryGroup(text) {
  if (!text || typeof text !== "string") return "Gaji & Pendapatan";
  const str = text.toLowerCase().trim();
  if (/bonus|thr|insentif|tunjangan/i.test(str)) return "Bonus & Tunjangan";
  if (/jual|dagang|toko|omset|omzet|proyek|freelance|klien|bisnis/i.test(str)) return "Bisnis & Penjualan";
  if (/investasi|dividen|saham|reksadana|crypto|bunga|deposito/i.test(str)) return "Investasi & Dividen";
  if (/hadiah|giveaway|cashback|angpao|hibah/i.test(str)) return "Hadiah & Cashback";
  if (/gaji|salary|upah|payroll|honor/i.test(str)) return "Gaji & Pendapatan";
  return "Gaji & Pendapatan";
}

export function getBudgetCategoryGroup(text) {
  if (!text || typeof text !== "string") return "Lainnya";
  const cat = text.toLowerCase().trim();

  // 1. Makanan & Minuman
  if (
    /makan|minum|kopi|coffee|coffe|\bteh\b|\btea\b|jus|juice|resto|restoran|cafe|kafe|kedai|warung|warteg|angkringan|kantin|dapur|kuliner|catering|katering|snack|cemilan|jajan|jajanan|dessert|food|beverage|meal|gofood|grabfood|shopeefood|nasi|gorengan|bakso|mie\b|mi\b|bihun|kwetiau|ramen|noodle|soto|rawon|pecel|sate|ayam|bebek|ikan|lele|seafood|udang|cumi|rendang|padang|geprek|penyet|lalapan|gudeg|pempek|siomay|batagor|seblak|cilok|cireng|cimol|martabak|terang\s*bulan|roti|bakery|kue|donat|donut|tahu|tempe|bubur|lontong|ketoprak|gulai|sop\b|steak|burger|pizza|spaghetti|pasta|sushi|dimsum|rice\s*bowl|ricebowl|bento|boba|bubble|milk\s*tea|es\b|ice\s*cream|eskrim|gelato|latte|espresso|cappuccino|matcha|coklat|gacoan|mixue|mcd\b|mcdonald|kfc|burger\s*king|hokben|hoka\s*hoka\s*bento|richeese|solaria|d['']?cost|fore\b|starbucks|janji\s*jiwa|kopi\s*kenangan|chatime|haus\b|kulo|point\s*coffee|teguk|jco|dunkin|breadtalk|mako|rotio|roti['\s]?o|chigo|wingstop|marugame|yoshinoya|subway|shihlin/i.test(
      cat
    )
  ) {
    return "Makanan & Minuman";
  }

  // 2. Transportasi
  if (
    /transport|bensin|bbm|pertamax|pertalite|solar|dexlite|spbu|pertamina|shell\b|bp\s*akr|vivo\b|gojek|goride|gocar|grab\b|grabcar|grabride|maxim|indriver|in-driver|anantar|ojek|ojol|taksi|taxi|bluebird|blue\s*bird|krl|commuter\s*line|mrt|lrt|transjakarta|busway|tj\b|damri|angkot|mikrolet|bus\b|bis\b|travel|kereta|kai\b|pesawat|flight|garuda|lion\s*air|citilink|airasia|batik\s*air|super\s*air\s*jet|kapal|ferry|pelni|tiket\.com|traveloka|tol\b|e-?toll|etoll|jasa\s*marga|parkir|karcis\s*parkir|valet|motor|mobil|kendaraan|bengkel|servis\s*motor|servis\s*mobil|ganti\s*oli|oli\b|ban\b|tambal\s*ban|cuci\s*motor|cuci\s*mobil|car\s*wash|helm|aki\b|sparepart|spare\s*part|onderdil|knalpot|rem\b|kampas|radiator|tune\s*up/i.test(
      cat
    )
  ) {
    return "Transportasi";
  }

  // 3. Tagihan & Pulsa (Diperiksa sebelum belanja agar pulsa/utilitas diprioritaskan)
  if (
    /tagihan|pulsa|kuota|paket\s*data|paket\s*internet|telkomsel|by\.?u|indosat|im3|xl\b|axiata|axis|smartfren|tri\b|three\b|listrik|pln|token\s*listrik|token\s*pln|pdam|air\s*bersih|iuran|iuran\s*rt|iuran\s*rw|keamanan|kebersihan|sampah|wifi|internet|indihome|biznet|first\s*media|myrepublic|iconnet|cbn|oxygen|kos\b|kost|kontrakan|sewa\s*rumah|sewa\s*kamar|maintenance\s*fee|ipl\b|bpjs|bpjs\s*kesehatan|bpjs\s*ketenagakerjaan|asuransi|premi|pajak|pbb|stnk|perpanjang\s*sim|cicilan|angsuran|kredit|leasing|pinjaman|pinjol|kpr|paylater|spaylater|gopaylater|kredivo|akulaku|langganan|subscription|netflix|spotify|youtube\s*premium|disney|hbo|vidio|prime\s*video|apple\s*music|icloud|google\s*one|google\s*drive|canva|chatgpt|github|hosting|domain|vps|top\s*up\s*(saldo|dana|gopay|ovo)|isi\s*saldo|gopay|ovo\b|dana\b|shopeepay|linkaja|e-?money|flazz|brizzi|tapcash/i.test(
      cat
    )
  ) {
    return "Tagihan & Pulsa";
  }

  // 4. Kesehatan
  if (
    /sehat|sakit|apotek|apotik|k24|kimia\s*farma|guardian|watsons|century|obat|paracetamol|panadol|bodrex|tolak\s*angin|antimo|promag|sanmol|amoxicillin|antibiotik|betadine|hansaplast|plester|perban|kasa|minyak\s*kayu\s*putih|balsem|salonpas|inhaler|dokter|klinik|puskesmas|rumah\s*sakit|rsud|rs\b|ugd|igd|periksa|spesialis|dokter\s*gigi|tambal\s*gigi|cabut\s*gigi|scaling|behel|dokter\s*mata|optik|kacamata|softlens|lensa|lab\b|laboratorium|tes\s*darah|rontgen|usg|rawat\s*inap|operasi|vaksin|imunisasi|swab|pcr|rapid|psikolog|psikiater|konseling|terapi|fisioterapi|pijat|urut|massage|refleksi|chiropractic|gym|fitness|member\s*gym|yoga|pilates|zumba|suplemen|whey|protein|creatine|vitamin|madu|herbal|jamu/i.test(
      cat
    )
  ) {
    return "Kesehatan";
  }

  // 5. Hiburan & Rekreasi
  if (
    /hiburan|rekreasi|bioskop|cinema|xxi|cgv|cinepolis|imax|premiere|tiket\s*nonton|konser|festival|tiket\s*konser|fan\s*meeting|stand\s*up|liburan|wisata|pantai|gunung|curug|air\s*terjun|taman|kebun\s*binatang|zoo|aquarium|dufan|ancol|taman\s*safari|waterboom|waterpark|camping|glamping|hotel|villa|resort|penginapan|airbnb|tiket\s*masuk|karaoke|billiard|biliar|bowling|timezone|funworld|arkade|escape\s*room|top\s*up\s*game|voucher\s*game|steam|steam\s*wallet|playstation|ps\s*[345]|nintendo|xbox|mobile\s*legends|diamond\s*ml|free\s*fire|diamond\s*ff|pubg|valorant|genshin|honkai|roblox|komik|manga|novel|gramedia|mainan|lego|gundam|action\s*figure|hobi|pancing|memancing|kamera|lensa\s*kamera|fotografi/i.test(
      cat
    )
  ) {
    return "Hiburan & Rekreasi";
  }

  // 6. Belanja & Harian
  if (
    /belanja|harian|indomaret|alfamart|alfamidi|superindo|transmart|lotte|hypermart|hero\b|pasar|warung\s*kelontong|toko|minimarket|supermarket|mall|plaza|shopee|tokopedia|lazada|tiktok\s*shop|blibli|bukalapak|sembako|beras|minyak\s*goreng|telur|gula|garam|bumbu|sayur|buah|daging|gas\b|lpg|elpiji|galon|aqua\b|le\s*minerale|cleo\b|vit\b|sabun|odol|sikat\s*gigi|pasta\s*gigi|detergen|deterjen|rinso|soklin|daia|pewangi|downy|molto|sunlight|mama\s*lemon|tisu|tissue|baygon|hit\b|kapur\s*barus|pembersih|pel\b|sapu\b|shampo|shampoo|kondisioner|potong\s*rambut|cukur|barbershop|barber|salon|pangkas|creambath|facial|skincare|skin\s*care|serum|sunscreen|toner|moisturizer|lotion|kosmetik|makeup|make\s*up|lipstik|bedak|parfum|deodorant|pomade|wax|baju|kaos|t-?shirt|kemeja|celana|jeans|jaket|jacket|hoodie|sweater|jas\b|gamis|hijab|kerudung|jilbab|mukena|sarung|sepatu|sneakers|sandal|tas\b|backpack|dompet|ikat\s*pinggang|gesper|kaos\s*kaki|singlet|distro|uniqlo|h&m|zara|atk|alat\s*tulis|fotokopi|fotocopy|print|percetakan|kertas|pulpen|buku\s*tulis|baterai|lampu|perabotan|furniture|peralatan|alat\s*rumah|laundry|cuci\s*baju|cuci\s*sepatu|setrika|dry\s*clean|tukang|sedot\s*wc|servis\s*laptop|servis\s*hp/i.test(
      cat
    )
  ) {
    return "Belanja & Harian";
  }

  return "Lainnya";
}
