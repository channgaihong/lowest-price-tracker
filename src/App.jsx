import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { Camera, Plus, Store, Tag, Calendar, AlertCircle, Image as ImageIcon, Trash2, X, DollarSign, CheckCircle2, Search, Lock, Unlock, Key, Users, UserPlus, Edit, Shield, Settings, AppWindow, Edit3, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Barcode, ScanLine } from 'lucide-react';

// --- Firebase 初始設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyB5pltbYRSQ8SdzZHu8dOqy7d7Vmh6r9CE",
  authDomain: "lowest-price-d02e6.firebaseapp.com",
  projectId: "lowest-price-d02e6",
  storageBucket: "lowest-price-d02e6.firebasestorage.app",
  messagingSenderId: "184526746178",
  appId: "1:184526746178:web:02e2753ff9a568e2b933db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "lowest-price-d02e6";

// --- 密碼加密工具 (SHA-256) ---
const hashPassword = async (password) => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Admin Authentication State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // 'super_admin' 或是 'admin'
  const [adminId, setAdminId] = useState(null); // 記錄當前登入管理員的文檔 ID
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Admin Management State (Super Admin Only)
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [adminList, setAdminList] = useState([]);
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);

  // Personal Password Change State (All Admins)
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [personalNewPassword, setPersonalNewPassword] = useState('');

  // Record Editing State (Global Edit Mode)
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const editFileInputRef = useRef(null);

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [barcode, setBarcode] = useState(''); // 新增條碼狀態
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningDetails, setWarningDetails] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState(null); // 'form', 'edit', 'search'

  // 1. 初始化登入驗證
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Authentication failed:", error);
        setLoading(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 讀取主要比價資料 & 系統設定
  useEffect(() => {
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return; // Canvas 必須等待驗證完成
    if (!db) {
      setLoading(false);
      return;
    }
    
    // 讀取最低價資料
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
    const unsubscribeItems = onSnapshot(colRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedItems.sort((a, b) => b.timestamp - a.timestamp);
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });

    // 讀取系統全域設定 (如 Favicon)
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSystemSettings(data);
        
        // 動態套用 Favicon 到網頁上
        if (data.customIcon) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.customIcon;
        }
      }
    });

    return () => {
      unsubscribeItems();
      unsubscribeSettings();
    };
  }, [db, user]);

  // 3. 讀取管理員清單 (僅限超級管理員開啟管理介面時)
  useEffect(() => {
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db || !isAdmin || adminRole !== 'super_admin' || !showAdminManager) return;
    
    const fetchAdmins = async () => {
      try {
        const adminColRef = collection(db, 'artifacts', appId, 'public', 'data', 'admin_users');
        const snapshot = await getDocs(adminColRef);
        setAdminList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching admins", err);
      }
    };
    fetchAdmins();
  }, [db, user, isAdmin, adminRole, showAdminManager]);

  // 當搜尋條件改變時，回到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  // --- 相機掃描器邏輯 ---
  useEffect(() => {
    let scanner = null;
    if (isScanning) {
      const initScanner = () => {
        if (document.getElementById('reader')) {
          scanner = new window.Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            false
          );
          scanner.render((decodedText) => {
            // 掃描成功後的處理
            if (scanTarget === 'form') setBarcode(decodedText);
            else if (scanTarget === 'edit') setEditingItem(prev => ({ ...prev, barcode: decodedText }));
            else if (scanTarget === 'search') setSearchQuery(decodedText);
            
            setIsScanning(false);
            if (scanner) scanner.clear();
          }, (err) => {
            // 忽略持續掃描中的錯誤
          });
        }
      };

      // 動態載入 html5-qrcode 套件
      if (!window.Html5QrcodeScanner) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.async = true;
        script.onload = initScanner;
        document.body.appendChild(script);
      } else {
        // 延遲一點確保 DOM 已經渲染 reader
        setTimeout(initScanner, 100);
      }
    }
    
    return () => {
      if (scanner) {
        scanner.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, [isScanning, scanTarget]);

  // --- 搜尋過濾與分頁計算 (加入條碼搜尋) ---
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.store.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.barcode && item.barcode.includes(searchQuery))
  );
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  
  // 防止在刪除最後一頁的唯一一筆資料時出錯
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // 進階的高壓縮圖片功能
  const compressImage = (file, maxWidth = 500, maxHeight = 500, quality = 0.5, mimeType = 'image/jpeg') => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) { 
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } 
          } else { 
            if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } 
          }
          canvas.width = width; 
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(mimeType, quality)); // 應用高壓縮率
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  // 新增記錄的圖片上傳
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setPhotoBase64(await compressImage(file, 500, 500, 0.5, 'image/jpeg'));
    }
  };

  // 編輯記錄的圖片上傳
  const handleEditFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      const compressed = await compressImage(file, 500, 500, 0.5, 'image/jpeg');
      setEditingItem(prev => ({ ...prev, photo: compressed }));
    }
  };

  // 系統圖示 (Favicon) 上傳
  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !db) return;
    setIsUploadingIcon(true);
    try {
      const iconBase64 = await compressImage(file, 128, 128, 0.8, 'image/png');
      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');
      await setDoc(settingsRef, { customIcon: iconBase64 }, { merge: true });
      alert("✅ 系統捷徑圖示更新成功！");
    } catch (err) {
      console.error(err);
      alert("圖示更新失敗，請稍後再試。");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  // --- 登入邏輯 ---
  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    
    if (adminUsername === 'root' && adminPassword === 'super123') {
      setIsAdmin(true);
      setAdminRole('super_admin');
      setAdminId('root');
      setShowAdminLogin(false);
      resetLoginStates();
      return;
    }

    if (!db) {
       setAdminLoginError('資料庫尚未連線，請確認設定。');
       return;
    }

    try {
      const hashedInputPassword = await hashPassword(adminPassword);

      const qHashed = query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), where('username', '==', adminUsername), where('password', '==', hashedInputPassword));
      const snapshotHashed = await getDocs(qHashed);
      
      if (!snapshotHashed.empty) {
        const userData = snapshotHashed.docs[0].data();
        setIsAdmin(true); setAdminRole(userData.role); setAdminId(snapshotHashed.docs[0].id); setShowAdminLogin(false); resetLoginStates();
        return;
      }

      // 相容舊帳號
      const qPlain = query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), where('username', '==', adminUsername), where('password', '==', adminPassword));
      const snapshotPlain = await getDocs(qPlain);

      if (!snapshotPlain.empty) {
        const userData = snapshotPlain.docs[0].data();
        const docId = snapshotPlain.docs[0].id;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', docId), { password: hashedInputPassword });
        setIsAdmin(true); setAdminRole(userData.role); setAdminId(docId); setShowAdminLogin(false); resetLoginStates();
        return;
      }

      setAdminLoginError('帳號或密碼錯誤。');
    } catch (err) {
      console.error("Login check failed", err);
      setAdminLoginError('連線錯誤，請稍後再試。');
    }
  };

  const resetLoginStates = () => {
    setAdminUsername(''); setAdminPassword(''); setAdminLoginError('');
  };

  // --- 管理員操作 ---
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!newAdminUser || !newAdminPass || !db) return;
    
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), where('username', '==', newAdminUser));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) { alert("此帳號名稱已存在，請使用其他名稱！"); return; }

      const hashedNewPass = await hashPassword(newAdminPass);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), { username: newAdminUser, password: hashedNewPass, role: newAdminRole, createdAt: Date.now() });
      alert("✅ 管理員新增成功！"); 
      setNewAdminUser(''); setNewAdminPass(''); setNewAdminRole('admin');
      
      const updatedList = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'));
      setAdminList(updatedList.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error adding admin", err); alert("新增失敗，請稍後再試：" + err.message);
    }
  };

  const handleDeleteAdmin = async (id) => {
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db) return;
    
    if (!window.confirm("確定要刪除這個管理員帳號嗎？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', id));
      setAdminList(adminList.filter(admin => admin.id !== id));
      alert("已成功刪除。");
    } catch (err) { console.error("Error deleting admin", err); }
  };

  const handleUpdatePassword = async (id) => {
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db || !editPassword) return;
    
    try {
      const hashedEditPass = await hashPassword(editPassword);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', id), { password: hashedEditPass });
      setEditingAdminId(null); setEditPassword(''); alert("✅ 密碼修改成功！");
      setAdminList(adminList.map(admin => admin.id === id ? { ...admin, password: hashedEditPass } : admin));
    } catch (err) { console.error("Error updating password", err); alert("修改失敗，請稍後再試。"); }
  };

  const handleUpdateOwnPassword = async (e) => {
    e.preventDefault();
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db || !personalNewPassword) return;
    if (adminId === 'root') { alert("內建的 Root 帳號為系統預設，無法在此修改密碼。"); return; }
    try {
      const hashedPersonalPass = await hashPassword(personalNewPassword);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', adminId), { password: hashedPersonalPass });
      alert("✅ 您的密碼已成功修改！"); setShowChangePasswordModal(false); setPersonalNewPassword('');
    } catch (err) { console.error("Error updating own password", err); alert("修改失敗，請稍後再試。"); }
  };

  // --- 記錄管理操作 ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!name || !price || !store || !date || !db || !isAdmin) return;

    const numPrice = parseFloat(price);
    const existingItem = items.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (existingItem && numPrice > existingItem.price) {
      setWarningDetails({ newName: name, newPrice: numPrice, oldPrice: existingItem.price, oldStore: existingItem.store, oldDate: existingItem.date });
      setShowWarningModal(true); return;
    }

    setIsSubmitting(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
      const docRef = existingItem ? doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', existingItem.id) : doc(colRef);
      await setDoc(docRef, { 
        name: name.trim(), 
        price: numPrice, 
        store: store.trim(), 
        date: date, 
        photo: photoBase64, 
        barcode: barcode.trim(), // 儲存條碼
        timestamp: Date.now() 
      });
      setSuccessMessage(`已成功記錄 ${name.trim()} 的最低價：$${numPrice}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setName(''); setPrice(''); setStore(''); setPhotoBase64(''); setBarcode(''); // 清空條碼
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) { console.error("Error saving document: ", error); } finally { setIsSubmitting(false); }
  };

  // 編輯現有記錄
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db || !isAdmin || !editingItem) return;

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', editingItem.id);
      await updateDoc(docRef, {
        name: editingItem.name.trim(),
        price: parseFloat(editingItem.price),
        store: editingItem.store.trim(),
        date: editingItem.date,
        photo: editingItem.photo,
        barcode: editingItem.barcode?.trim() || '', // 更新條碼
        timestamp: Date.now()
      });
      setSuccessMessage(`已成功更新 ${editingItem.name.trim()} 的記錄！`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("更新失敗，請稍後再試。");
    }
  };

  const handleDelete = async (id) => {
    const isCanvas = typeof __firebase_config !== 'undefined';
    if (isCanvas && !user) return;
    if (!db || !isAdmin) return;
    if (!window.confirm("確定要刪除這筆比價紀錄嗎？")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', id)); } 
    catch (error) { console.error("Error deleting document: ", error); }
  };

  // 計算分頁範圍
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 md:pb-10">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {systemSettings.customIcon ? (
              <img src={systemSettings.customIcon} alt="Logo" className="w-6 h-6 object-contain" />
            ) : (
              <Tag className="w-6 h-6" />
            )}
            <h1 className="text-xl font-bold">最低價記錄系統</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 只有超級管理員可以看到系統管理 */}
            {isAdmin && adminRole === 'super_admin' && (
              <button onClick={() => setShowAdminManager(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-sm font-medium transition-colors">
                <AppWindow className="w-4 h-4" /> <span className="hidden sm:inline">系統設定</span>
              </button>
            )}

            {/* 所有管理員都能修改自己的密碼 */}
            {isAdmin && (
               <button onClick={() => setShowChangePasswordModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-lg text-sm font-medium transition-colors">
                 <Settings className="w-4 h-4" /> <span className="hidden sm:inline">修改密碼</span>
               </button>
            )}

            <button onClick={() => {
              if(isAdmin) { setIsAdmin(false); setAdminRole(null); setAdminId(null); setIsGlobalEditMode(false); }
              else { setShowAdminLogin(true); }
            }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 rounded-full text-sm font-medium transition-colors">
              {isAdmin ? <><Unlock className="w-4 h-4" /> <span className="hidden sm:inline">登出 ({adminRole === 'super_admin' ? '超級' : '一般'})</span></> : <><Lock className="w-4 h-4" /> 登入</>}
            </button>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : ''} gap-6`}>
        {/* 左側表單 (管理員可見) */}
        {isAdmin && (
          <div className="md:col-span-1 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-5 sticky top-24 ring-1 ring-emerald-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-700">
                  <Plus className="w-5 h-5" /> 新增比價記錄
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                 {/* 條碼輸入區塊 */}
                 <div>
                   <label className="block text-sm font-medium text-gray-600 mb-1">商品條碼 (可選)</label>
                   <div className="flex gap-2">
                     <input type="text" placeholder="掃描或手動輸入" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
                     <button type="button" onClick={() => { setScanTarget('form'); setIsScanning(true); }} className="px-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl transition-colors flex items-center justify-center" title="使用相機掃描">
                       <ScanLine className="w-5 h-5" />
                     </button>
                   </div>
                 </div>

                 <div><label className="block text-sm font-medium text-gray-600 mb-1">日期</label><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">物品名稱</label><input type="text" required placeholder="例如：衛生紙 12入" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">價格</label><input type="number" step="0.01" min="0" required placeholder="輸入價格" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">商店名稱</label><input type="text" required placeholder="例如：全聯" value={store} onChange={(e) => setStore(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                 <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">圖片 (高壓縮儲存)</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden relative">
                    {photoBase64 ? <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-400" />}
                    <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
                  </label>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                  {isSubmitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "記錄最低價"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 右側清單 */}
        <div className={isAdmin ? "md:col-span-2" : "md:col-span-3 max-w-3xl mx-auto w-full"}>
          {successMessage && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{successMessage}</div>}
          {!isAdmin && <div className="mb-6 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100"><p className="text-sm">目前為公開檢視模式，登入管理員以新增紀錄。</p></div>}
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="搜尋名稱、商店或掃描條碼..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <button type="button" onClick={() => { setScanTarget('search'); setIsScanning(true); }} className="px-4 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl shadow-sm transition-colors flex items-center justify-center" title="掃描條碼搜尋">
                <ScanLine className="w-5 h-5" />
              </button>
            </div>

            {/* 全域編輯功能按鈕 (管理員可見) */}
            {isAdmin && (
              <button 
                onClick={() => setIsGlobalEditMode(!isGlobalEditMode)} 
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl shadow-sm font-medium transition-colors whitespace-nowrap border ${
                  isGlobalEditMode 
                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {isGlobalEditMode ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                {isGlobalEditMode ? '關閉編輯模式' : '啟用編輯模式'}
              </button>
            )}
          </div>

          <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
            {paginatedItems.map((item) => (
              <div key={item.id} className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col group hover:shadow-md transition-all ${isGlobalEditMode ? 'border-blue-200 ring-1 ring-blue-50' : 'border-gray-100'}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-800 break-all">{item.name}</h3>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      {/* 只有在啟用全域編輯模式時，才顯示單個卡片的編輯按鈕 */}
                      {isGlobalEditMode && (
                        <button onClick={() => setEditingItem(item)} className="p-1 text-gray-300 hover:text-blue-500 bg-gray-50 hover:bg-blue-50 rounded transition-colors" title="編輯這筆記錄">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-300 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded transition-colors" title="刪除記錄">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  {item.photo ? <img src={item.photo} alt={item.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0" /> : <div className="w-20 h-20 rounded-lg bg-gray-50 border flex items-center justify-center flex-shrink-0"><ImageIcon className="w-8 h-8 text-gray-300" /></div>}
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <div className="text-2xl font-black text-emerald-600">${item.price.toFixed(2)}</div>
                    <div className="text-sm text-gray-600 truncate"><Store className="w-3 h-3 inline mr-1"/>{item.store}</div>
                    <div className="text-xs text-gray-400 mt-1 truncate"><Calendar className="w-3 h-3 inline mr-1"/>{item.date}</div>
                    {/* 顯示條碼 */}
                    {item.barcode && (
                      <div className="text-xs text-gray-400 mt-1 flex items-center gap-1 truncate">
                        <Barcode className="w-3 h-3" /> {item.barcode}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {paginatedItems.length === 0 && (
               <div className="col-span-full py-10 text-center text-gray-400 border-2 border-dashed rounded-2xl">沒有找到符合的紀錄</div>
            )}
          </div>

          {/* 分頁與每頁顯示數量控制器 */}
          {filteredItems.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>每頁顯示：</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="border-gray-200 bg-gray-50 rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
                >
                  <option value={12}>12 筆</option>
                  <option value={24}>24 筆</option>
                  <option value={48}>48 筆</option>
                </select>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>第 <strong className="text-gray-900">{currentPage}</strong> 頁 / 共 {totalPages} 頁 (總計 {filteredItems.length} 筆)</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- 掃描器 Modal --- */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-emerald-600" /> 掃描商品條碼
              </h3>
              <button onClick={() => setIsScanning(false)} className="p-1 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            {/* html5-qrcode 渲染容器 */}
            <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border-2 border-dashed border-gray-300 min-h-[250px]"></div>
            <p className="text-xs text-center text-gray-500 mt-4">請將商品條碼或 QR Code 對準畫面中央</p>
          </div>
        </div>
      )}

      {/* --- 編輯現有記錄 Modal --- */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-xl font-bold text-blue-700 flex items-center gap-2">
                <Edit3 className="w-5 h-5" /> 編輯記錄
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">商品條碼 (可選)</label>
                <div className="flex gap-2">
                  <input type="text" value={editingItem.barcode || ''} onChange={(e) => setEditingItem({...editingItem, barcode: e.target.value})} className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30" />
                  <button type="button" onClick={() => { setScanTarget('edit'); setIsScanning(true); }} className="px-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-xl transition-colors">
                    <ScanLine className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">日期</label>
                <input type="date" required value={editingItem.date} onChange={(e) => setEditingItem({...editingItem, date: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">物品名稱</label>
                <input type="text" required value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">價格</label>
                <input type="number" step="0.01" min="0" required value={editingItem.price} onChange={(e) => setEditingItem({...editingItem, price: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">商店名稱</label>
                <input type="text" required value={editingItem.store} onChange={(e) => setEditingItem({...editingItem, store: e.target.value})} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">更新圖片 (選填)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-200 border-dashed rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors overflow-hidden relative">
                  {editingItem.photo ? <img src={editingItem.photo} alt="Preview" className="w-full h-full object-cover" /> : <div className="text-gray-400 flex flex-col items-center"><Camera className="w-8 h-8 mb-1" /><span className="text-xs">無圖片，點擊上傳</span></div>}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-medium">點擊更換圖片</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" ref={editFileInputRef} onChange={handleEditFileChange} />
                </label>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">取消</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors">儲存變更</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 管理員登入 Modal --- */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-6">登入管理系統</h3>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">帳號</label>
                <input type="text" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" autoFocus />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">密碼</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              {adminLoginError && <p className="text-rose-500 text-sm">{adminLoginError}</p>}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => {setShowAdminLogin(false); resetLoginStates();}} className="flex-1 py-2 bg-gray-100 rounded-xl hover:bg-gray-200">取消</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700">登入</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 管理員：修改個人密碼 Modal --- */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2 justify-center mb-6 text-emerald-600">
              <Key className="w-6 h-6" />
              <h3 className="text-xl font-bold">修改個人密碼</h3>
            </div>
            <form onSubmit={handleUpdateOwnPassword} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">請輸入新密碼</label>
                <input 
                  type="password" 
                  required
                  value={personalNewPassword} 
                  onChange={(e) => setPersonalNewPassword(e.target.value)} 
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" 
                  autoFocus 
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => {setShowChangePasswordModal(false); setPersonalNewPassword('');}} className="flex-1 py-2 bg-gray-100 rounded-xl hover:bg-gray-200">取消</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700">確認修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 超級管理員專屬：系統與帳號管理 Modal --- */}
      {showAdminManager && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-emerald-600"/> 系統與帳號設定</h3>
              <button onClick={() => setShowAdminManager(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>

            {/* 系統自訂圖示區塊 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4"/> 系統自訂圖示 (Favicon)</h4>
              <div className="flex items-center gap-4">
                {systemSettings.customIcon ? (
                   <img src={systemSettings.customIcon} alt="Favicon" className="w-12 h-12 rounded object-contain border bg-white" />
                ) : (
                   <div className="w-12 h-12 rounded border bg-gray-200 flex items-center justify-center text-xs text-gray-400">預設</div>
                )}
                <label className={`px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-sm font-medium ${isUploadingIcon ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isUploadingIcon ? '上傳中...' : '上傳新圖示'}
                  <input type="file" className="hidden" accept="image/*" onChange={handleFaviconUpload} disabled={isUploadingIcon} />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">建議使用正方形圖片，系統會自動壓縮以適合網站分頁標籤顯示。</p>
            </div>

            {/* 新增管理員區塊 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-3"><UserPlus className="w-4 h-4"/> 新增管理員</h4>
              <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="輸入帳號" required value={newAdminUser} onChange={e => setNewAdminUser(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                <input type="text" placeholder="設定密碼" required value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)} className="px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="admin">一般管理員</option>
                  <option value="super_admin">超級管理員</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">新增</button>
              </form>
            </div>

            {/* 管理員列表區塊 */}
            <div>
              <h4 className="font-bold text-gray-700 mb-3">現有帳號清單</h4>
              <div className="space-y-3">
                {adminList.map(admin => (
                  <div key={admin.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 text-xs rounded font-bold ${admin.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {admin.role === 'super_admin' ? '超級' : '一般'}
                      </div>
                      <span className="font-medium">{admin.username}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editingAdminId === admin.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="新密碼" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-emerald-500 outline-none" autoFocus />
                          <button onClick={() => handleUpdatePassword(admin.id)} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600">儲存</button>
                          <button onClick={() => {setEditingAdminId(null); setEditPassword('');}} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingAdminId(admin.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 bg-gray-100 rounded-md transition-colors" title="強制修改密碼">
                          <Edit className="w-4 h-4"/>
                        </button>
                      )}
                      
                      <button onClick={() => handleDeleteAdmin(admin.id)} className="p-1.5 text-gray-400 hover:text-rose-600 bg-gray-100 rounded-md transition-colors" title="刪除帳號">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                ))}
                {adminList.length === 0 && <p className="text-gray-400 text-sm text-center py-4">資料庫中尚無自訂帳號，目前僅能使用 Root 帳號登入。</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- 價格警告 Modal --- */}
      {showWarningModal && warningDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-rose-500 p-4 flex justify-between items-center text-white"><div className="font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5"/> 價格較高，不作記錄</div><button onClick={() => setShowWarningModal(false)}><X className="w-6 h-6"/></button></div>
            <div className="p-6">
              <p className="mb-4">您輸入的 {warningDetails.newName} 價格為 <strong className="text-rose-600">${warningDetails.newPrice}</strong>。</p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6"><p className="text-sm text-gray-500 mb-1">歷史最低價為：</p><div className="text-3xl font-black text-emerald-600 mb-2">${warningDetails.oldPrice}</div></div>
              <button onClick={() => setShowWarningModal(false)} className="w-full py-3 bg-gray-900 text-white hover:bg-gray-800 rounded-xl transition-colors">我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}