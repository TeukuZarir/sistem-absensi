document.addEventListener('DOMContentLoaded', () => {
    // --- KONFIGURASI ---
    const GITHUB_USERNAME = "NAMA_USER_GITHUB_ANDA"; 
    const REPO_NAME = "sistem-absensi"; 
    const GITHUB_TOKEN = "TOKEN_GITHUB_ANDA"; // !!! SANGAT RAHASIA !!!
    
    // --- ELEMEN DOM ---
    const loginPage = document.getElementById('login-page');
    const adminDashboard = document.getElementById('admin-dashboard');
    const studentDashboard = document.getElementById('student-dashboard');

    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    
    // --- Utility Functions ---
    const showPage = (pageId) => {
        [loginPage, adminDashboard, studentDashboard].forEach(p => p.classList.add('hidden'));
        document.getElementById(pageId).classList.remove('hidden');
    };

    // Fungsi untuk berkomunikasi dengan API GitHub
    const githubApi = async (filePath, method = 'GET', content = null) => {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${filePath}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
        };

        const options = { method, headers };

        if (method === 'PUT' && content) {
            options.body = JSON.stringify(content);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error interacting with GitHub:", error);
            return null;
        }
    };

    const getData = async (filePath) => {
        const data = await githubApi(filePath);
        if (data && data.content) {
            return JSON.parse(atob(data.content));
        }
        return null;
    };
    
    const updateData = async (filePath, newData, commitMessage) => {
        const fileData = await githubApi(filePath);
        const currentSha = fileData ? fileData.sha : undefined;
        
        const content = {
            message: commitMessage,
            content: btoa(JSON.stringify(newData, null, 2)),
            sha: currentSha,
        };

        return await githubApi(filePath, 'PUT', content);
    };

    // --- LOGIKA LOGIN ---
    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        loginError.textContent = '';

        if (!username || !password) {
            loginError.textContent = 'Username dan password tidak boleh kosong.';
            return;
        }

        const users = await getData('db_users.json');
        if (!users) {
            loginError.textContent = 'Gagal memuat data pengguna.';
            return;
        }
        
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            sessionStorage.setItem('loggedInUser', JSON.stringify(user));
            if (user.role === 'admin') {
                initAdminDashboard(user);
            } else {
                initStudentDashboard(user);
            }
        } else {
            loginError.textContent = 'Username atau password salah.';
        }
    });
    
    // --- LOGIKA LOGOUT ---
    const handleLogout = () => {
        sessionStorage.removeItem('loggedInUser');
        usernameInput.value = '';
        passwordInput.value = '';
        showPage('login-page');
    };
    
    document.getElementById('logout-btn-admin').addEventListener('click', handleLogout);
    document.getElementById('logout-btn-student').addEventListener('click', handleLogout);


    // --- DASHBOARD ADMIN ---
    const initAdminDashboard = async (user) => {
        document.getElementById('admin-welcome').textContent = `Selamat datang, ${user.name}!`;
        showPage('admin-dashboard');
        loadAttendanceData();

        // Logika untuk tabs
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                tabs.forEach(t => {
                    t.classList.remove('border-blue-500', 'text-blue-600');
                    t.classList.add('border-transparent', 'text-gray-500');
                });
                tab.classList.add('border-blue-500', 'text-blue-600');
                tab.classList.remove('border-transparent', 'text-gray-500');
                
                contents.forEach(c => c.classList.add('hidden'));
                document.querySelector(tab.getAttribute('href') + '-content').classList.remove('hidden');
            });
        });
    };
    
    const loadAttendanceData = async () => {
        const tableBody = document.getElementById('attendance-table-body');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Memuat data...</td></tr>';
        
        const attendanceLog = await getData('db_attendance.log.json');
        if (attendanceLog && attendanceLog.length > 0) {
            tableBody.innerHTML = '';
            attendanceLog.forEach(log => {
                const row = `
                    <tr>
                        <td class="border px-4 py-2">${log.username}</td>
                        <td class="border px-4 py-2">${log.name}</td>
                        <td class="border px-4 py-2">${new Date(log.timestamp).toLocaleString('id-ID')}</td>
                        <td class="border px-4 py-2 text-green-600 font-bold">${log.status}</td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Belum ada data absensi.</td></tr>';
        }
    };
    
    // Export ke Excel
    document.getElementById('download-excel-btn').addEventListener('click', async () => {
        const attendanceLog = await getData('db_attendance.log.json');
        if(!attendanceLog || attendanceLog.length === 0) {
            alert("Tidak ada data untuk diunduh.");
            return;
        }
        
        const worksheet = XLSX.utils.json_to_sheet(attendanceLog);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");
        XLSX.writeFile(workbook, "RekapAbsensi.xlsx");
    });
    
    // Tambah Mahasiswa
    document.getElementById('add-student-btn').addEventListener('click', async () => {
        const name = document.getElementById('new-student-name').value;
        const username = document.getElementById('new-student-username').value;
        const password = document.getElementById('new-student-password').value;

        if (!name || !username || !password) {
            alert('Semua field harus diisi!');
            return;
        }

        const users = await getData('db_users.json');
        if (users.find(u => u.username === username)) {
            alert('Username sudah ada!');
            return;
        }
        
        users.push({ username, password, name, role: 'student' });
        
        const result = await updateData('db_users.json', users, `Menambahkan mahasiswa baru: ${username}`);
        if(result) {
            alert('Mahasiswa berhasil ditambahkan!');
            document.getElementById('new-student-name').value = '';
            document.getElementById('new-student-username').value = '';
            document.getElementById('new-student-password').value = '';
        } else {
            alert('Gagal menambahkan mahasiswa.');
        }
    });

    // --- DASHBOARD MAHASISWA ---
    const initStudentDashboard = async (user) => {
        document.getElementById('student-welcome').textContent = `Selamat datang, ${user.name}!`;
        showPage('student-dashboard');
        loadStudentSchedule(user);
    };

    const loadStudentSchedule = async (user) => {
        const scheduleDiv = document.getElementById('student-schedule');
        const attendBtn = document.getElementById('attend-btn');
        const statusDiv = document.getElementById('attendance-status');
        
        const schedules = await getData('db_schedules.json');
        const today = new Date().toLocaleString('id-ID', { weekday: 'long' });
        
        const userSchedule = schedules.find(s => s.username === user.username && s.day === today);

        if (userSchedule) {
            scheduleDiv.innerHTML = `
                <p><strong>Hari:</strong> ${userSchedule.day}</p>
                <p><strong>Waktu Masuk:</strong> ${userSchedule.time}</p>
            `;
            attendBtn.disabled = false;
            attendBtn.dataset.schedule = JSON.stringify(userSchedule);
        } else {
            scheduleDiv.innerHTML = 'Tidak ada jadwal untuk Anda hari ini.';
            attendBtn.disabled = true;
        }
    };
    
    // Fungsi Absensi
    document.getElementById('attend-btn').addEventListener('click', (e) => {
        const schedule = JSON.parse(e.target.dataset.schedule);
        const statusDiv = document.getElementById('attendance-status');
        statusDiv.textContent = 'Mendapatkan lokasi Anda...';
        
        if (!navigator.geolocation) {
            statusDiv.textContent = 'Browser Anda tidak mendukung Geolocation.';
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                const distance = calculateDistance(latitude, longitude, schedule.latitude, schedule.longitude);
                
                if (distance <= schedule.radius) {
                    statusDiv.textContent = 'Lokasi valid! Memproses absensi...';
                    await recordAttendance();
                } else {
                    statusDiv.textContent = `Anda berada ${distance.toFixed(0)} meter dari lokasi yang ditentukan. Absensi gagal.`;
                    statusDiv.classList.add('text-red-500');
                }
            },
            () => {
                statusDiv.textContent = 'Gagal mendapatkan lokasi. Pastikan Anda memberikan izin akses lokasi.';
                statusDiv.classList.add('text-red-500');
            }
        );
    });

    const recordAttendance = async () => {
        const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
        const attendanceLog = await getData('db_attendance.log.json');
        
        const newLog = {
            username: user.username,
            name: user.name,
            timestamp: new Date().toISOString(),
            status: "Hadir"
        };
        
        attendanceLog.push(newLog);
        
        const result = await updateData('db_attendance.log.json', attendanceLog, `Absensi oleh ${user.username}`);
        if(result) {
            document.getElementById('attendance-status').textContent = 'Absensi berhasil direkam!';
            document.getElementById('attendance-status').classList.remove('text-red-500');
            document.getElementById('attendance-status').classList.add('text-green-500');
            document.getElementById('attend-btn').disabled = true;
        } else {
             document.getElementById('attendance-status').textContent = 'Gagal merekam absensi.';
             document.getElementById('attendance-status').classList.add('text-red-500');
        }
    };

    // Fungsi untuk menghitung jarak (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3; // meter
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // dalam meter
    };
    
    // --- Inisialisasi Aplikasi ---
    const checkLoginStatus = () => {
        const user = sessionStorage.getItem('loggedInUser');
        if(user) {
            const userData = JSON.parse(user);
            if (userData.role === 'admin') {
                initAdminDashboard(userData);
            } else {
                initStudentDashboard(userData);
            }
        } else {
            showPage('login-page');
        }
    };

    checkLoginStatus();
});
