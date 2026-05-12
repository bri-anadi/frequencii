# Requirements Document

## Introduction

Fitur ini mencakup konversi penuh semua fitur web Frequencii ke aplikasi mobile React Native/Expo, sehingga pengguna mobile mendapatkan paritas fungsional dengan web app. Frequencii adalah platform prediction market berbasis Solana yang privacy-first — setiap trade dirutekan melalui ZK-shielded ephemeral burner wallet agar posisi tidak bisa dilacak on-chain.

Mobile app saat ini sudah memiliki auth (MWA), markets list/trade, portfolio, AI agent chat, dan Seeker panel. Yang belum ada atau belum fungsional: ZK-Shielded Burner Wallet, P2P Chat (MagicBlock), Crypto Gift, Push Notifications, Market Search & Filter yang lengkap, Trade UX improvements, Portfolio Analytics, dan Seeker-exclusive features.

Target utama adalah Seeker device (Android), dengan UX touch-first menggunakan bottom sheets dan native gestures.

---

## Glossary

- **Mobile_App**: Aplikasi React Native/Expo yang berjalan di Android (target utama: Seeker device)
- **MWA**: Mobile Wallet Adapter — protokol untuk menghubungkan wallet Solana (Phantom, dll.) ke aplikasi mobile Android
- **Burner_Wallet**: Ephemeral keypair Solana yang di-generate dan di-enkripsi di device; digunakan untuk trading anonim
- **PrivacyCash_Bridge**: Lapisan abstraksi native yang menjembatani PrivacyCash/Light Protocol SDK ke React Native (menggantikan WASM yang tidak RN-safe)
- **ZK_Pool**: ZK-shielded pool berbasis Light Protocol yang memutus tautan on-chain antara main wallet dan burner wallet
- **P2P_Chat**: Fitur pesan langsung antar wallet menggunakan MagicBlock Ephemeral Rollups; gasless dan settle ke Solana L1
- **MagicBlock_Signer**: Adapter React Native yang mem-port MagicBlock transaction signer dari browser ke RN environment
- **Chat_Room_PDA**: Program Derived Address di Solana yang menyimpan pesan chat per user (seed: `chat_v2` + public key)
- **Delegation**: Proses mendelegasikan Chat_Room_PDA ke MagicBlock Ephemeral Rollup agar transaksi menjadi gasless
- **Crypto_Gift**: Fitur transfer SOL shielded melalui ZK_Pool ke alamat wallet penerima
- **Watchlist**: Daftar prediction market event yang disimpan user untuk dipantau
- **Push_Token**: Token registrasi Expo Push Notification yang dikirim ke backend untuk pengiriman notifikasi
- **Seeker_Device**: Smartphone Android "Solana Seeker" yang memiliki Genesis Token NFT sebagai bukti kepemilikan
- **Genesis_Token**: NFT eksklusif pemegang Seeker device; diverifikasi via `/api/v1/seeker/verify`
- **Seeker_Exclusive**: Konten atau fitur yang hanya dapat diakses oleh pemegang Genesis_Token yang terverifikasi
- **Bottom_Sheet**: Komponen UI modal yang muncul dari bawah layar, sesuai dengan pola navigasi mobile
- **SSE**: Server-Sent Events — protokol streaming satu arah dari server ke client untuk AI agent response
- **JWT**: JSON Web Token — token autentikasi stateless dengan masa berlaku 7 hari
- **PnL**: Profit and Loss — kalkulasi keuntungan/kerugian posisi trading
- **API_Client**: Modul `src/api/client.ts` di mobile app yang menjadi satu-satunya jalur untuk semua HTTP request
- **SecureStore**: `expo-secure-store` — penyimpanan terenkripsi di device untuk JWT dan data sensitif
- **NativeKeyStore**: Penyimpanan native terenkripsi untuk private key Burner_Wallet menggunakan `expo-secure-store` (menggantikan `localStorage` yang tidak tersedia di RN)

---

## Requirements

### Requirement 1: ZK-Shielded Burner Wallet — Setup & Enkripsi

**User Story:** Sebagai trader privacy-conscious di mobile, saya ingin membuat dan menyimpan burner wallet yang terenkripsi di device saya, sehingga saya bisa trading tanpa mengekspos main wallet saya ke on-chain history.

#### Acceptance Criteria

1. WHEN pengguna membuka Privacy Screen dan belum memiliki Burner_Wallet (tidak ada data di NativeKeyStore dengan key `frequencii_burner_pubkey`), THE Mobile_App SHALL menampilkan tombol "Setup Private Wallet" sebagai entry point utama dan tidak menampilkan tombol "Unlock Private Wallet"
2. WHEN pengguna membuka Privacy Screen dan Burner_Wallet sudah ada (key `frequencii_burner_pubkey` tersedia di NativeKeyStore), THE Mobile_App SHALL menampilkan public key yang tersimpan dan tombol "Unlock Private Wallet", bukan tombol "Setup Private Wallet"
3. WHEN pengguna memulai setup Burner_Wallet, THE Mobile_App SHALL menampilkan step-by-step progress dengan empat tahap berurutan: "Generating keypair" → "Requesting MWA signature" → "Encrypting" → "Stored"
4. WHEN MWA signature berhasil diperoleh dan panjangnya minimal 32 byte, THE Mobile_App SHALL menurunkan AES-GCM encryption key dari 32 byte pertama signature menggunakan `react-native-quick-crypto`; IF signature lebih pendek dari 32 byte, THE Mobile_App SHALL menampilkan error "Wallet signature too short. Please try again." dan menghentikan proses setup
5. WHEN encryption key berhasil diturunkan, THE Mobile_App SHALL mengenkripsi secret key Burner_Wallet dan menyimpannya di NativeKeyStore dengan key `frequencii_burner_encrypted`
6. THE Mobile_App SHALL menyimpan public key Burner_Wallet di NativeKeyStore dengan key `frequencii_burner_pubkey` (tidak terenkripsi, hanya untuk display)
7. IF proses setup gagal pada tahap manapun, THEN THE Mobile_App SHALL menampilkan pesan error yang spesifik untuk tahap yang gagal dan menyediakan tombol "Retry" yang mengulang hanya dari tahap yang gagal tanpa mengulang tahap yang sudah berhasil
8. IF penulisan ke NativeKeyStore gagal (misalnya storage penuh atau izin ditolak), THEN THE Mobile_App SHALL menampilkan error "Failed to save wallet. Check device storage and try again." dan tidak melanjutkan ke tahap berikutnya
9. WHEN setup berhasil, THE Mobile_App SHALL menampilkan 4 karakter pertama dan 4 karakter terakhir dari base58 public key Burner_Wallet (format: `XXXX...XXXX`) beserta status "Private Wallet Active"
10. THE Mobile_App SHALL memastikan secret key Burner_Wallet tidak pernah disimpan dalam bentuk plaintext di storage manapun — hanya ciphertext AES-GCM yang boleh ditulis ke NativeKeyStore

### Requirement 2: ZK-Shielded Burner Wallet — Unlock & Balance

**User Story:** Sebagai pengguna yang sudah memiliki Burner_Wallet, saya ingin membuka kunci wallet tersebut dengan signature MWA saya, sehingga saya bisa melihat saldo dan menggunakannya untuk trading.

#### Acceptance Criteria

1. WHEN pengguna membuka Privacy Screen dan Burner_Wallet sudah di-setup (key `frequencii_burner_pubkey` tersedia di NativeKeyStore), THE Mobile_App SHALL menampilkan public key dalam format `XXXX...XXXX` dan tombol "Unlock Private Wallet"
2. WHEN pengguna menekan "Unlock Private Wallet", THE Mobile_App SHALL meminta MWA signature dengan pesan tetap "Frequencii Private Prediction Wallet"
3. WHEN MWA signature diterima, THE Mobile_App SHALL mendekripsi secret key dari NativeKeyStore menggunakan key yang diturunkan dari signature; IF dekripsi gagal (misalnya data korup atau key tidak cocok pada tahap dekripsi), THEN THE Mobile_App SHALL menampilkan error "Unlock failed. Please try again." dan tidak melanjutkan proses
4. IF dekripsi berhasil namun public key yang dihasilkan dari secret key hasil dekripsi tidak cocok dengan public key yang tersimpan di NativeKeyStore, THEN THE Mobile_App SHALL menampilkan error "Decryption produced wrong key. Was this wallet created with a different main wallet?" dan tidak mengizinkan akses ke keypair
5. WHEN unlock berhasil, THE Mobile_App SHALL mengambil saldo Burner_Wallet dari Solana RPC dan menampilkannya dalam satuan SOL dengan presisi 4 desimal
6. WHILE Burner_Wallet dalam keadaan unlocked, THE Mobile_App SHALL memperbarui saldo setiap 15 detik menggunakan interval timer yang dimulai segera setelah unlock berhasil
7. WHEN pengguna menutup Privacy Screen atau sign out, THE Mobile_App SHALL menghapus keypair dari memory (in-memory state) tanpa menghapus data terenkripsi dari NativeKeyStore

### Requirement 3: ZK-Shielded Burner Wallet — Funding via PrivacyCash_Bridge

**User Story:** Sebagai pengguna dengan Burner_Wallet yang sudah di-unlock, saya ingin mendanai wallet tersebut melalui ZK shielded pool, sehingga tidak ada tautan on-chain antara main wallet dan burner wallet saya.

#### Acceptance Criteria

1. THE Mobile_App SHALL mengimplementasikan PrivacyCash_Bridge sebagai native module atau REST proxy yang mengekspos operasi `signIn`, `deposit`, `withdraw`, dan `getBalance` tanpa bergantung pada WASM browser
2. WHEN pengguna memasukkan jumlah SOL yang valid (antara 0.01 dan 10 SOL) dan menekan "Fund via ZK Pool", THE Mobile_App SHALL menampilkan tiga tahap progress berurutan dengan indikator status active/complete/failed: "Signing into privacy layer" → "Depositing to ZK pool" → "Withdrawing to burner address"
3. WHEN deposit ke ZK_Pool berhasil dan jumlah SOL yang dipilih lebih dari 0, THE Mobile_App SHALL melanjutkan ke withdraw ke alamat Burner_Wallet secara otomatis dalam satu flow; setiap tahap memiliki timeout 60 detik — IF timeout terlampaui, THE Mobile_App SHALL menandai tahap tersebut sebagai failed dan menghentikan flow
4. IF pengguna memasukkan jumlah SOL kurang dari 0.01 atau lebih dari 10, THEN THE Mobile_App SHALL menampilkan pesan validasi "Amount must be between 0.01 and 10 SOL" dan menonaktifkan tombol "Fund via ZK Pool"
5. WHEN seluruh funding flow selesai, THE Mobile_App SHALL menampilkan konfirmasi "Private wallet funded. No on-chain link to your main wallet." beserta saldo Burner_Wallet terbaru
6. IF `signIn`, deposit, atau withdraw gagal, THEN THE Mobile_App SHALL menampilkan error spesifik untuk tahap yang gagal; pengguna dapat mencoba ulang maksimal 3 kali per tahap — IF batas retry tercapai, THE Mobile_App SHALL menampilkan "Max retries reached. Please try again later." dan menonaktifkan tombol retry
7. WHEN pengguna memasukkan jumlah SOL yang valid (antara 0.01 dan 10 SOL), THE Mobile_App SHALL menampilkan estimasi biaya ZK withdrawal sebesar 0.007 SOL di bawah input field sebelum pengguna menekan konfirmasi
8. IF PrivacyCash_Bridge tidak terinisialisasi atau tidak terdaftar sebagai native module saat runtime, THEN THE Mobile_App SHALL menampilkan status "Guarded — Native SDK wiring required" dan menonaktifkan tombol "Fund via ZK Pool"

### Requirement 4: P2P Chat — Inisialisasi & Delegasi MagicBlock

**User Story:** Sebagai pengguna Frequencii di mobile, saya ingin menginisialisasi chat room saya di Solana dan mendelegasikannya ke MagicBlock Ephemeral Rollup, sehingga saya bisa mengirim pesan secara gasless.

#### Acceptance Criteria

1. THE Mobile_App SHALL mengimplementasikan MagicBlock_Signer sebagai adapter yang mengekspos tiga operasi yang dapat dipanggil: `initialize` (membuat Chat_Room_PDA di L1), `delegate` (mendelegasikan PDA ke Ephemeral Rollup), dan `sendMessage` (mengirim pesan via rollup) — semua operasi menggunakan MWA untuk signing transaksi
2. WHEN pengguna membuka P2P Chat untuk pertama kali, THE Mobile_App SHALL memeriksa apakah Chat_Room_PDA sudah diinisialisasi di Solana L1; IF status inisialisasi tersimpan di SecureStore sebagai `true`, THE Mobile_App SHALL melewati pengecekan on-chain dan langsung menampilkan antarmuka chat
3. IF Chat_Room_PDA belum diinisialisasi, THEN THE Mobile_App SHALL menampilkan tombol "Initialize Chat" beserta penjelasan bahwa ini memerlukan satu transaksi L1 dan biaya gas
4. WHEN pengguna menekan "Initialize Chat", THE Mobile_App SHALL membangun transaksi batch yang berisi instruksi `initialize` + `delegateChat` dan meminta MWA signature dalam satu sesi wallet
5. WHEN transaksi berhasil dikonfirmasi di L1 dalam waktu 60 detik, THE Mobile_App SHALL menyimpan status `initialized: true` di SecureStore dan menampilkan status "Chat Active — Gasless messaging enabled"; IF konfirmasi tidak diterima dalam 60 detik, THE Mobile_App SHALL menampilkan error "Transaction confirmation timed out. Check your wallet and try again."
6. IF Chat_Room_PDA sudah diinisialisasi (status `initialized: true` di SecureStore), THE Mobile_App SHALL langsung menampilkan antarmuka chat tanpa meminta transaksi baru
7. IF pengecekan on-chain gagal (RPC error atau network timeout), THEN THE Mobile_App SHALL menghapus cache status inisialisasi di SecureStore dan menampilkan error "Could not verify chat status. Check your connection and try again."
8. IF pengguna membatalkan atau menolak MWA signing prompt saat inisialisasi, THEN THE Mobile_App SHALL kembali ke state sebelum signing (tombol "Initialize Chat" kembali aktif) tanpa menampilkan error

### Requirement 5: P2P Chat — Manajemen Kontak

**User Story:** Sebagai pengguna P2P Chat, saya ingin menambah, melihat, dan menghapus kontak berdasarkan alamat wallet Solana, sehingga saya bisa memilih dengan siapa saya berkomunikasi.

#### Acceptance Criteria

1. WHEN pengguna membuka P2P Chat Screen, THE Mobile_App SHALL menampilkan daftar kontak yang tersimpan di SecureStore dengan key `frequencii_p2p_contacts`; IF daftar kosong, THE Mobile_App SHALL menampilkan pesan "No contacts yet. Add a wallet address to start chatting."
2. WHEN pengguna memasukkan alamat wallet Solana yang valid (base58, 32–44 karakter) dan menekan "Add Contact", THE Mobile_App SHALL menambahkan kontak ke daftar dengan label default "Contact N" di mana N adalah ukuran daftar saat ini + 1
3. WHEN pengguna memasukkan alamat wallet yang sudah ada di daftar, THE Mobile_App SHALL menampilkan pesan "Contact already exists" secara inline dan tidak menambahkan duplikat
4. IF alamat wallet yang dimasukkan tidak valid (bukan base58 valid atau panjang di luar rentang 32–44 karakter), THEN THE Mobile_App SHALL menampilkan error "Invalid Solana wallet address" secara inline di bawah input field dan mengabaikan aksi penambahan kontak
5. WHEN pengguna menekan lama (≥ 500ms) pada kontak, THE Mobile_App SHALL menampilkan action sheet dengan dua opsi: "Rename" dan "Remove Contact"
6. WHEN pengguna memilih "Rename", THE Mobile_App SHALL menampilkan input dialog dengan label kontak saat ini sebagai nilai awal; WHEN pengguna mengkonfirmasi nama baru, THE Mobile_App SHALL memperbarui label kontak di SecureStore dan di daftar yang ditampilkan
7. WHEN pengguna memilih kontak dari daftar, THE Mobile_App SHALL membuka Bottom_Sheet chat dengan kontak tersebut
8. WHEN kontak ditampilkan, THE Mobile_App SHALL menampilkan avatar berupa karakter pertama dari label kontak dengan background warna #d4ff62

### Requirement 6: P2P Chat — Kirim & Terima Pesan Real-time

**User Story:** Sebagai pengguna P2P Chat yang sudah memiliki kontak, saya ingin mengirim dan menerima pesan secara real-time melalui MagicBlock Ephemeral Rollups, sehingga komunikasi terasa instan dan gasless.

#### Acceptance Criteria

1. WHEN pengguna mengetik pesan dan menekan "Send", THE Mobile_App SHALL memvalidasi bahwa pesan tidak kosong dan tidak hanya terdiri dari whitespace, kemudian membangun transaksi `sendMessage` dan mengirimkannya via MagicBlock_Signer
2. WHILE Chat_Room_PDA sudah terdelegasi, THE Mobile_App SHALL mengirim pesan melalui MagicBlock Ephemeral Rollup (bukan L1) untuk pengiriman gasless
3. IF Chat_Room_PDA belum terdelegasi saat pengiriman, THEN THE Mobile_App SHALL secara otomatis menambahkan instruksi `delegateChat` ke transaksi sebelum `sendMessage`
4. IF instruksi `delegateChat` gagal dieksekusi, THEN THE Mobile_App SHALL membatalkan pengiriman pesan dan menampilkan pesan error yang mengindikasikan kegagalan delegasi kepada pengguna
5. THE Mobile_App SHALL melakukan polling Chat_Room_PDA setiap 2 detik untuk setiap kontak aktif menggunakan MagicBlock router connection
6. WHEN pesan baru terdeteksi (timestamp lebih baru dari lastTimestamp yang tersimpan), THE Mobile_App SHALL menampilkan pesan di antarmuka chat dalam waktu tidak lebih dari 3 detik sejak pesan dikirim
7. THE Mobile_App SHALL menampilkan pesan dengan bubble chat: pesan dari diri sendiri di sisi kanan layar, pesan dari kontak di sisi kiri layar
8. IF pengiriman pesan gagal, THEN THE Mobile_App SHALL menampilkan indikator error yang terlihat secara visual pada bubble pesan tersebut dan menyediakan tombol "Retry"
9. WHEN pengiriman pesan berhasil, THE Mobile_App SHALL menghapus indikator error dan tombol "Retry" dari bubble pesan tersebut
10. THE Mobile_App SHALL membatasi panjang pesan maksimal 280 karakter dan menampilkan counter karakter ketika jumlah karakter yang diketik mencapai 261 atau lebih

### Requirement 7: Crypto Gift — Shielded SOL Transfer

**User Story:** Sebagai pengguna P2P Chat, saya ingin mengirim SOL sebagai hadiah kepada kontak saya melalui ZK shielded pool, sehingga transfer tidak bisa dilacak on-chain.

#### Acceptance Criteria

1. WHEN pengguna membuka chat dengan kontak dan menekan ikon gift, THE Mobile_App SHALL menampilkan Bottom_Sheet "Send Private Gift"
2. THE Mobile_App SHALL menampilkan saldo private (ZK_Pool) dan saldo public (main wallet) pengguna di dalam gift sheet
3. WHEN pengguna memasukkan jumlah SOL dan menekan "Send Private Gift", THE Mobile_App SHALL memvalidasi bahwa jumlah minimal 0.01 SOL; IF jumlah kurang dari 0.01 SOL, THE Mobile_App SHALL menampilkan error "Minimum gift amount is 0.01 SOL" dan tidak melanjutkan
4. IF saldo ZK_Pool tidak mencukupi untuk jumlah yang dimasukkan, THEN THE Mobile_App SHALL secara otomatis melakukan deposit dari main wallet ke ZK_Pool sebesar kekurangan + 0.002 SOL buffer; IF saldo main wallet juga tidak mencukupi untuk auto-deposit, THE Mobile_App SHALL menampilkan error "Insufficient balance in both wallets" dan tidak melanjutkan
5. IF auto-deposit gagal (transaksi ditolak atau timeout), THEN THE Mobile_App SHALL menampilkan error "Auto-deposit failed. Please fund your private wallet manually." dan tidak melanjutkan ke withdrawal
6. WHEN withdrawal dari ZK_Pool ke alamat penerima berhasil, THE Mobile_App SHALL menampilkan konfirmasi dengan transaction hash dan menutup gift sheet
7. WHEN pengguna memasukkan jumlah SOL yang valid (≥ 0.01 SOL), THE Mobile_App SHALL menampilkan estimasi biaya withdrawal sebesar 0.007 SOL di bawah input field sebelum pengguna mengkonfirmasi pengiriman
8. IF PrivacyCash_Bridge tidak terinisialisasi saat gift sheet dibuka, THEN THE Mobile_App SHALL menampilkan status "Draft only — Shielded transfer disabled" dan menonaktifkan tombol "Send Private Gift"; WHEN pengguna menutup dan membuka ulang gift sheet sementara bridge sudah tersedia, THE Mobile_App SHALL mengaktifkan tombol pengiriman
9. THE Mobile_App SHALL hanya mendukung SOL sebagai token gift; opsi USDC dan USDT ditampilkan dengan label "Soon" dan dalam keadaan dinonaktifkan (tidak dapat dipilih)

### Requirement 8: Push Notifications — Registrasi & Manajemen

**User Story:** Sebagai pengguna mobile, saya ingin menerima push notification untuk event-event penting di platform, sehingga saya tidak melewatkan peluang trading atau update market.

#### Acceptance Criteria

1. WHEN pengguna membuka Profile Screen dan status izin push notification belum ditentukan (belum pernah diminta), THE Mobile_App SHALL meminta izin push notification menggunakan Expo Notifications API
2. WHEN izin diberikan, THE Mobile_App SHALL mencoba mendaftarkan Expo push token ke backend via `PUT /api/v1/user/profile` dengan field `pushToken`; IF request backend gagal, THE Mobile_App SHALL menampilkan pesan "Notification registration failed. Tap to retry." di Profile Screen
3. WHEN push token berhasil didaftarkan ke backend, THE Mobile_App SHALL menyimpan token di SecureStore dengan key `frequencii_push_token` dan menampilkan status "Notifications Active" di Profile Screen
4. IF pengguna menolak izin push notification, THEN THE Mobile_App SHALL menampilkan pesan "Enable notifications in device settings to receive market alerts" tanpa memblokir penggunaan app
5. WHILE push notification aktif, THE Mobile_App SHALL mendukung notifikasi untuk tiga jenis event: (a) market akan berakhir dalam 1 jam, (b) posisi bisa di-claim, dan (c) pesan P2P baru diterima
6. WHEN pengguna menekan push notification jenis (a), THE Mobile_App SHALL membuka Markets Screen dan menampilkan market detail yang relevan; WHEN jenis (b), THE Mobile_App SHALL membuka Positions Screen; WHEN jenis (c), THE Mobile_App SHALL membuka P2P Chat Screen dengan kontak yang mengirim pesan
7. WHEN pengguna menekan "Disable Notifications" di Profile Screen, THE Mobile_App SHALL mengirim request ke backend untuk menghapus push token; IF request gagal, THE Mobile_App SHALL menampilkan "Failed to disable notifications. Try again." dan tidak menghapus token dari SecureStore
8. WHEN pengguna membuka Profile Screen dan izin push notification sudah ditolak sebelumnya, THE Mobile_App SHALL menampilkan status "Notifications Disabled" dengan tombol "Open Settings" yang membuka pengaturan notifikasi device

### Requirement 9: Market Search & Filter — Lengkap

**User Story:** Sebagai trader, saya ingin mencari dan memfilter prediction market berdasarkan kata kunci, kategori, dan urutan, sehingga saya bisa menemukan market yang relevan dengan cepat.

#### Acceptance Criteria

1. WHEN pengguna mengetuk search bar di bagian atas Markets Screen, THE Mobile_App SHALL memberikan auto-focus pada input field sehingga keyboard langsung muncul
2. WHEN pengguna mengetik di search bar, THE Mobile_App SHALL menunggu tepat 400ms setelah keystroke terakhir sebelum mengirim request ke `/api/v1/markets?search=...`; request sebelumnya yang masih pending SHALL dibatalkan
3. THE Mobile_App SHALL menampilkan filter kategori sebagai horizontal scrollable pills dengan urutan: All, crypto, politics, sports, economics, culture, mentions; "All" dipilih secara default
4. WHEN pengguna memilih kategori pill, THE Mobile_App SHALL langsung mengirim request baru ke API dengan parameter `category` yang sesuai tanpa memerlukan aksi tambahan dari pengguna
5. THE Mobile_App SHALL menampilkan sort options dengan tiga pilihan: "Volume" (default), "Newest", "Ending Soon" sebagai segmented control atau dropdown yang selalu terlihat
6. WHEN pengguna memilih sort option, THE Mobile_App SHALL mengirim parameter `sort` ke API dan memperbarui daftar market dengan hasil yang diurutkan sesuai pilihan
7. WHEN pengguna mencapai 80% dari bawah daftar market yang ditampilkan, THE Mobile_App SHALL secara otomatis mengirim request berikutnya dengan parameter `offset` yang sesuai dan menambahkan 30 market berikutnya ke daftar yang ada (bukan mengganti)
8. WHEN API mengembalikan hasil kosong untuk kombinasi filter aktif, THE Mobile_App SHALL menampilkan pesan "No markets found for [nama filter aktif]" beserta tombol "Clear Filters" yang mereset semua filter ke nilai default
9. WHEN pengguna kembali ke Markets Screen setelah membuka market detail, THE Mobile_App SHALL mempertahankan state filter yang terakhir aktif (kategori, teks search, sort) dan posisi scroll

### Requirement 10: Trade UX — Simulation Feedback & Step-by-Step Status

**User Story:** Sebagai trader di mobile, saya ingin melihat feedback simulasi transaksi dan status step-by-step yang jelas sebelum dan selama proses trade, sehingga saya tahu persis apa yang terjadi dan bisa mendeteksi masalah lebih awal.

#### Acceptance Criteria

1. WHEN pengguna memilih outcome dan mengubah jumlah di market detail, THE Mobile_App SHALL memperbarui estimasi price impact (dalam %) dan jumlah shares yang akan diterima (dengan presisi 4 desimal) secara reaktif
2. WHEN pengguna menekan "Build Trade", THE Mobile_App SHALL menampilkan Bottom_Sheet konfirmasi dengan ringkasan: outcome yang dipilih, jumlah, estimasi shares, dan alamat wallet yang membayar fee
3. WHEN pengguna mengkonfirmasi trade, THE Mobile_App SHALL selalu memulai progress steps dari tahap pertama secara berurutan: "Building transaction" → "Simulating" → "Requesting signature" → "Submitted"
4. IF simulasi transaksi gagal, THEN THE Mobile_App SHALL mereset state trade ke IDLE (form kembali aktif, steps disembunyikan), menampilkan pesan error dalam bahasa yang dapat dibaca manusia (kalimat tunggal ≤ 120 karakter, tanpa raw JSON atau stack trace), dan menyediakan tombol "Try Again"
5. IF simulasi berhasil tapi pengguna membatalkan MWA signing prompt, THEN THE Mobile_App SHALL kembali ke state IDLE tanpa menampilkan pesan error
6. IF signing gagal karena alasan selain pembatalan pengguna (misalnya network timeout atau MWA error), THEN THE Mobile_App SHALL menampilkan pesan error yang sesuai dan menyediakan tombol "Try Again"
7. WHEN trade berhasil disubmit, THE Mobile_App SHALL menampilkan transaction ID yang dapat di-tap untuk membuka Solana Explorer di browser
8. WHILE proses trade berlangsung (state bukan IDLE), THE Mobile_App SHALL menampilkan spinner dan teks status yang sesuai dengan tahap aktif saat ini
9. WHILE proses trade berlangsung (state bukan IDLE), THE Mobile_App SHALL menonaktifkan tombol konfirmasi trade untuk mencegah double-submit

### Requirement 11: Trade UX — Error Handling yang Lebih Baik

**User Story:** Sebagai trader, saya ingin mendapatkan pesan error yang jelas dan actionable ketika trade gagal, sehingga saya tahu apa yang salah dan bagaimana cara memperbaikinya.

#### Acceptance Criteria

1. IF trade gagal karena insufficient funds, THEN THE Mobile_App SHALL menampilkan "Insufficient balance. You need at least [X] USDC to place this trade." di mana [X] adalah jumlah minimum yang dibutuhkan
2. IF trade gagal karena market sudah closed (API mengembalikan flag `market_closed_error`), THEN THE Mobile_App SHALL menampilkan "This market has closed. Refresh to see updated status."
3. WHEN error market closed ditampilkan, THE Mobile_App SHALL memperbarui status market di UI dengan label "Closed" tanpa memerlukan refresh manual dari pengguna
4. IF trade gagal karena MWA timeout (lebih dari 45 detik tanpa respons), THEN THE Mobile_App SHALL menampilkan "Wallet request timed out. Reopen your wallet and try again."
5. IF trade gagal karena network error (tidak ada koneksi atau request timeout), THEN THE Mobile_App SHALL menampilkan "Network error. Check your connection and try again." beserta tombol "Retry" yang mengirim ulang request yang sama; tombol Retry dapat digunakan maksimal 3 kali
6. WHEN error trade terjadi, THE Mobile_App SHALL mencatat ke console log dengan context lengkap: market ID, outcome, amount, dan error message
7. WHEN error trade ditampilkan, THE Mobile_App SHALL menyediakan tombol "Dismiss" yang menutup error state dan mengembalikan UI ke state sebelum trade dimulai

### Requirement 12: Portfolio Analytics — PnL Chart & Visualisasi Posisi

**User Story:** Sebagai trader, saya ingin melihat visualisasi PnL dan ringkasan portfolio saya, sehingga saya bisa memahami performa trading saya secara keseluruhan.

#### Acceptance Criteria

1. WHEN pengguna membuka Positions Screen, THE Mobile_App SHALL menampilkan ringkasan portfolio di bagian atas: total value, total PnL (nominal dan persentase), dan jumlah posisi aktif
2. WHEN Positions Screen dimuat dan terdapat minimal satu posisi, THE Mobile_App SHALL menampilkan PnL chart dengan sumbu X (waktu) dan sumbu Y (nilai PnL dalam USD) yang terlihat jelas
3. WHEN chart ditampilkan, THE Mobile_App SHALL merender minimal satu data point per posisi yang ada, menggunakan seluruh riwayat posisi yang tersedia sebagai rentang waktu default
4. WHEN total PnL positif, THE Mobile_App SHALL menampilkan nilai PnL dengan warna hijau; WHEN negatif, dengan warna merah; WHEN nol atau tidak ada posisi, THE Mobile_App SHALL menampilkan nilai PnL dengan warna netral (abu-abu)
5. WHEN Positions Screen dimuat dan terdapat minimal satu posisi, THE Mobile_App SHALL menampilkan breakdown posisi per kategori market (minimal: crypto, politics, sports, economics) sebagai chart sederhana
6. WHEN pengguna menekan posisi individual di daftar, THE Mobile_App SHALL menampilkan detail posisi: entry price, current price, PnL, dan status (active/resolved/claimable)
7. IF posisi memiliki status `claimable: true`, THEN THE Mobile_App SHALL menampilkan badge "Claimable" yang menonjol pada posisi tersebut di daftar
8. WHEN Positions Screen dimuat dan tidak ada posisi sama sekali, THE Mobile_App SHALL menampilkan pesan "No positions yet. Start trading to see your portfolio here." tanpa menampilkan chart atau ringkasan numerik

### Requirement 13: Seeker-Exclusive Features

**User Story:** Sebagai pemegang Seeker Genesis Token, saya ingin mengakses fitur dan konten eksklusif yang tidak tersedia untuk pengguna biasa, sehingga kepemilikan Seeker device saya memberikan nilai tambah nyata.

#### Acceptance Criteria

1. WHEN pengguna membuka Seeker Screen dan Genesis_Token terverifikasi, THE Mobile_App SHALL menampilkan badge "Seeker Verified" dan mint address token dalam format yang disingkat (4 karakter pertama + "..." + 4 karakter terakhir)
2. WHERE Genesis_Token terverifikasi, THE Mobile_App SHALL merender section "Seeker Exclusive" yang berisi konten eksklusif; WHERE Genesis_Token tidak terverifikasi, section tersebut SHALL tidak dirender sama sekali (bukan hanya disembunyikan)
3. WHERE Genesis_Token terverifikasi, THE Mobile_App SHALL memberikan akses ke market dengan label "Seeker Only" yang tidak muncul di daftar market umum
4. WHERE Genesis_Token terverifikasi, THE Mobile_App SHALL menampilkan AI agent dengan konteks tambahan yang mencakup data market eksklusif Seeker dan indikator "Early Access" untuk market yang belum tersedia secara umum
5. IF Genesis_Token tidak ditemukan di wallet, THEN THE Mobile_App SHALL menetapkan status verifikasi sebagai false, menonaktifkan semua Seeker_Exclusive features, dan menampilkan pesan yang menjelaskan bahwa fitur eksklusif memerlukan Seeker device yang terverifikasi beserta link ke informasi cara mendapatkan Seeker
6. WHEN pengguna membuka Seeker Screen, THE Mobile_App SHALL selalu melakukan verifikasi Genesis_Token ke backend via `/api/v1/seeker/verify` (bukan menggunakan cache dari login)
7. WHERE device terdeteksi sebagai Seeker berdasarkan identifikasi hardware device, THE Mobile_App SHALL menampilkan UI hint "Running on Seeker" di header Seeker Screen
8. IF request verifikasi ke `/api/v1/seeker/verify` gagal karena network error atau RPC error, THEN THE Mobile_App SHALL menampilkan error "Verification failed. Check your connection and try again." dengan tombol "Retry" dan tidak mengubah status verifikasi yang ada sebelumnya

### Requirement 14: Navigation & UX Mobile-First

**User Story:** Sebagai pengguna mobile, saya ingin navigasi yang intuitif dan sesuai dengan pola UX mobile native, sehingga pengalaman menggunakan Frequencii di mobile terasa natural dan efisien.

#### Acceptance Criteria

1. WHEN pengguna membuka app setelah login, THE Mobile_App SHALL menampilkan bottom tab bar yang selalu terlihat di bagian bawah layar dengan tab: Chat, Markets, Portfolio, Privacy, Seeker, Profile — menggantikan horizontal scroll tab yang ada saat ini
2. WHEN pengguna membuka market detail, trade confirmation, gift modal, atau kontak chat, THE Mobile_App SHALL menampilkan konten tersebut dalam Bottom_Sheet yang muncul dari bawah layar, bukan Modal fullscreen
3. WHEN Bottom_Sheet terbuka, THE Mobile_App SHALL mendukung swipe ke bawah untuk menutup sheet; sheet SHALL menutup sepenuhnya ketika swipe mencapai 50% dari tinggi sheet
4. WHEN pengguna melakukan pull-to-refresh pada Markets Screen, Positions Screen, atau Seeker Screen, THE Mobile_App SHALL memulai fetch data baru; IF fetch tidak selesai dalam 30 detik, THE Mobile_App SHALL menampilkan error "Refresh timed out. Try again." dan mengembalikan UI ke state sebelum refresh
5. WHEN keyboard muncul di layar manapun yang memiliki input field, THE Mobile_App SHALL menggunakan `KeyboardAvoidingView` sehingga input field tetap sepenuhnya terlihat dalam viewport
6. WHEN Markets Screen atau Positions Screen pertama kali dimuat (sebelum data tersedia), THE Mobile_App SHALL menampilkan skeleton loading state yang merepresentasikan layout konten yang akan muncul
7. WHEN pengguna mengkonfirmasi trade, THE Mobile_App SHALL memicu haptic feedback; WHEN pengguna toggle watchlist, THE Mobile_App SHALL memicu haptic feedback; WHEN pengguna mengirim pesan chat, THE Mobile_App SHALL memicu haptic feedback; IF device tidak mendukung haptic, THE Mobile_App SHALL melanjutkan aksi tanpa error
8. WHEN elemen UI interaktif dirender, THE Mobile_App SHALL memastikan area touch target minimal 44x44 dp untuk semua tombol, tab, dan elemen yang dapat ditekan

### Requirement 15: Watchlist — Persistensi & Sinkronisasi

**User Story:** Sebagai trader, saya ingin menyimpan market favorit saya ke watchlist dan melihatnya di Profile Screen, sehingga saya bisa memantau market yang paling relevan dengan mudah.

#### Acceptance Criteria

1. WHEN Markets Screen dirender, THE Mobile_App SHALL menampilkan tombol "Save" atau "Saved" pada setiap market row secara konsisten, dengan state yang mencerminkan status watchlist terkini dari backend
2. WHEN pengguna menekan "Save" pada market yang belum di-watchlist, THE Mobile_App SHALL langsung memperbarui tombol menjadi "Saved" (optimistic update) dan mengirim `POST /api/v1/watchlist/:eventId` di background
3. WHEN pengguna menekan "Saved" pada market yang sudah di-watchlist, THE Mobile_App SHALL langsung memperbarui tombol menjadi "Save" (optimistic update) dan mengirim `DELETE /api/v1/watchlist/:eventId` di background
4. IF request watchlist gagal (network error atau server error), THEN THE Mobile_App SHALL melakukan rollback optimistic update ke state sebelumnya dan menampilkan toast error "Watchlist update failed. Try again."
5. WHEN pengguna membuka Profile Screen, THE Mobile_App SHALL menampilkan daftar watchlist dengan data market terbaru: title, volume, dan current price untuk setiap market
6. WHEN pengguna menekan market di daftar watchlist pada Profile Screen, THE Mobile_App SHALL membuka market detail dalam Bottom_Sheet langsung dari Profile Screen
7. WHEN Markets Screen pertama kali dibuka, THE Mobile_App SHALL memuat daftar watchlist dari backend dan menyinkronkan state watchlist sehingga tombol Save/Saved di Markets Screen dan daftar di Profile Screen selalu konsisten satu sama lain

### Requirement 16: Session Management & Token Refresh

**User Story:** Sebagai pengguna mobile, saya ingin sesi saya tetap aktif selama mungkin tanpa harus login ulang, sehingga pengalaman menggunakan app tidak terganggu oleh expired session.

#### Acceptance Criteria

1. WHEN API manapun mengembalikan HTTP 401 dan tidak ada token refresh yang sedang berjalan, THE Mobile_App SHALL secara otomatis memanggil `POST /api/v1/auth/refresh` satu kali
2. WHILE token refresh sedang berjalan, THE Mobile_App SHALL mengantrekan semua request yang menerima HTTP 401 dan mengulang semua request tersebut secara otomatis setelah refresh berhasil
3. WHEN token refresh berhasil, THE Mobile_App SHALL menyimpan token baru ke SecureStore dan mengulang semua request yang diantrekan secara otomatis
4. IF token refresh gagal karena server menolak token (HTTP 401/403) atau karena network error setelah 3 percobaan, THEN THE Mobile_App SHALL menghapus semua session data dari SecureStore terlebih dahulu, kemudian menampilkan layar login; THE Mobile_App SHALL tidak menampilkan layar login sebelum session data dihapus
5. WHEN app kembali ke foreground dan token akan expired dalam kurang dari 60 menit, THE Mobile_App SHALL secara otomatis memanggil `POST /api/v1/auth/refresh`
6. IF proactive refresh gagal saat app kembali ke foreground, THEN THE Mobile_App SHALL mempertahankan token yang ada dan mencoba refresh kembali pada event foreground berikutnya tanpa menampilkan error ke pengguna
7. WHEN pengguna sign out, THE Mobile_App SHALL menghapus JWT dari SecureStore, menghapus MWA authorization cache, dan mereset auth state serta Burner_Wallet keypair dari memory

