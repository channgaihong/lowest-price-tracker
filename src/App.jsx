import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { Camera, Plus, Store, Tag, Calendar, AlertCircle, Image as ImageIcon, Trash2, X, DollarSign, CheckCircle2, Search, Lock, Unlock, Key, Users, UserPlus, Edit, Shield } from 'lucide-react';

// --- Firebase Initialization ---
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
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

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Admin Authentication State
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // 'super_admin' 或是 'admin'
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

  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [photoBase64, setPhotoBase64] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Modal State
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningDetails, setWarningDetails] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 讀取主要比價資料
  useEffect(() => {
    if (!user || !db) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedItems.sort((a, b) => b.timestamp - a.timestamp);
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. 讀取管理員清單 (僅限超級管理員開啟管理介面時)
  useEffect(() => {
    if (isAdmin && adminRole === 'super_admin' && showAdminManager && db) {
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
    }
  }, [isAdmin, adminRole, showAdminManager]);

  // 圖片壓縮功能
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } 
          else { if (height > 800) { width *= 800 / height; height = 800; } }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setPhotoBase64(await compressImage(file));
    }
  };

  // --- 登入邏輯 ---
  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    
    // 預設無敵超級帳號 (讓您可以建立第一個資料庫帳號)
    if (adminUsername === 'root' && adminPassword === 'super123') {
      setIsAdmin(true);
      setAdminRole('super_admin');
      setShowAdminLogin(false);
      resetLoginStates();
      return;
    }

    if (!db) {
       setAdminLoginError('資料庫尚未連線，請確認設定。');
       return;
    }

    // 檢查 Firebase 資料庫內的帳號
    try {
      const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), 
        where('username', '==', adminUsername),
        where('password', '==', adminPassword)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setIsAdmin(true);
        setAdminRole(userData.role);
        setShowAdminLogin(false);
        resetLoginStates();
      } else {
        setAdminLoginError('帳號或密碼錯誤。');
      }
    } catch (err) {
      console.error("Login check failed", err);
      setAdminLoginError('連線錯誤，請稍後再試。');
    }
  };

  const resetLoginStates = () => {
    setAdminUsername('');
    setAdminPassword('');
    setAdminLoginError('');
  };

  // --- 超級管理員功能：新增與管理管理員 ---
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminUser || !newAdminPass || !db) return;
    try {
      // 檢查帳號是否重複
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), where('username', '==', newAdminUser));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        alert("此帳號名稱已存在！");
        return;
      }
      // 寫入新管理員
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'), {
        username: newAdminUser,
        password: newAdminPass,
        role: newAdminRole,
        createdAt: Date.now()
      });
      setNewAdminUser(''); setNewAdminPass(''); setNewAdminRole('admin');
      // 重新讀取清單
      const updatedList = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'admin_users'));
      setAdminList(updatedList.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error adding admin", err);
    }
  };

  const handleDeleteAdmin = async (id) => {
    if (!window.confirm("確定要刪除這個管理員帳號嗎？")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', id));
      setAdminList(adminList.filter(admin => admin.id !== id));
    } catch (err) {
      console.error("Error deleting admin", err);
    }
  };

  const handleUpdatePassword = async (id) => {
    if (!editPassword) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_users', id), {
        password: editPassword
      });
      setEditingAdminId(null);
      setEditPassword('');
      alert("密碼修改成功！");
      // 更新本機畫面資料
      setAdminList(adminList.map(admin => admin.id === id ? { ...admin, password: editPassword } : admin));
    } catch (err) {
      console.error("Error updating password", err);
    }
  };

  // --- 記錄最低價表單送出 ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || !store || !date || !user || !db || !isAdmin) return;

    const numPrice = parseFloat(price);
    const existingItem = items.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (existingItem && numPrice > existingItem.price) {
      setWarningDetails({ newName: name, newPrice: numPrice, oldPrice: existingItem.price, oldStore: existingItem.store, oldDate: existingItem.date });
      setShowWarningModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
      const docRef = existingItem ? doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', existingItem.id) : doc(colRef);
      
      await setDoc(docRef, {
        name: name.trim(), price: numPrice, store: store.trim(), date: date, photo: photoBase64, timestamp: Date.now()
      });

      setSuccessMessage(`已成功記錄 ${name.trim()} 的最低價：$${numPrice}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setName(''); setPrice(''); setStore(''); setPhotoBase64('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error("Error saving document: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !db || !isAdmin) return;
    if (!window.confirm("確定要刪除這筆比價紀錄嗎？")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', id)); } 
    catch (error) { console.error("Error deleting document: ", error); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>;

  const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.store.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 md:pb-10">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6" />
            <h1 className="text-xl font-bold">最低價記錄系統</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 只有超級管理員可以看到這個按鈕 */}
            {isAdmin && adminRole === 'super_admin' && (
              <button onClick={() => setShowAdminManager(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 rounded-lg text-sm font-medium transition-colors">
                <Users className="w-4 h-4" /> 帳號管理
              </button>
            )}

            <button onClick={() => {
              if(isAdmin) { setIsAdmin(false); setAdminRole(null); }
              else { setShowAdminLogin(true); }
            }} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 rounded-full text-sm font-medium transition-colors">
              {isAdmin ? <><Unlock className="w-4 h-4" /> 登出 ({adminRole === 'super_admin' ? '超級管理員' : '管理員'})</> : <><Lock className="w-4 h-4" /> 管理員登入</>}
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
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">日期</label><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 border rounded-xl" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">物品名稱</label><input type="text" required placeholder="例如：衛生紙 12入" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border rounded-xl" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">價格</label><input type="number" step="0.01" min="0" required placeholder="輸入價格" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2 border rounded-xl" /></div>
                 <div><label className="block text-sm font-medium text-gray-600 mb-1">商店名稱</label><input type="text" required placeholder="例如：全聯" value={store} onChange={(e) => setStore(e.target.value)} className="w-full px-4 py-2 border rounded-xl" /></div>
                 <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">圖片 (可選)</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 overflow-hidden relative">
                    {photoBase64 ? <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-400" />}
                    <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
                  </label>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium">記錄最低價</button>
              </form>
            </div>
          </div>
        )}

        {/* 右側清單 */}
        <div className={isAdmin ? "md:col-span-2" : "md:col-span-3 max-w-3xl mx-auto w-full"}>
          {successMessage && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2"><CheckCircle2 className="w-5 h-5" />{successMessage}</div>}
          {!isAdmin && <div className="mb-6 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100"><p className="text-sm">目前為公開檢視模式，登入管理員以新增紀錄。</p></div>}
          
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="搜尋物品名稱或商店..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 border rounded-xl shadow-sm" />
          </div>

          <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
            {filteredItems.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col group">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-800 break-all">{item.name}</h3>
                  {isAdmin && <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
                </div>
                <div className="flex gap-4">
                  {item.photo ? <img src={item.photo} alt={item.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100" /> : <div className="w-20 h-20 rounded-lg bg-gray-50 border flex items-center justify-center"><ImageIcon className="w-8 h-8 text-gray-300" /></div>}
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-2xl font-black text-emerald-600">${item.price.toFixed(2)}</div>
                    <div className="text-sm text-gray-600"><Store className="w-3 h-3 inline mr-1"/>{item.store}</div>
                    <div className="text-xs text-gray-400 mt-1"><Calendar className="w-3 h-3 inline mr-1"/>{item.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* --- 管理員登入 Modal --- */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-center mb-6">登入管理系統</h3>
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">帳號</label>
                <input type="text" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} className="w-full px-4 py-2 border rounded-xl" autoFocus />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">密碼</label>
                <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              {adminLoginError && <p className="text-rose-500 text-sm">{adminLoginError}</p>}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => {setShowAdminLogin(false); resetLoginStates();}} className="flex-1 py-2 bg-gray-100 rounded-xl">取消</button>
                <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white rounded-xl">登入</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 超級管理員專屬：帳號管理 Modal --- */}
      {showAdminManager && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-emerald-600"/> 系統帳號管理</h3>
              <button onClick={() => setShowAdminManager(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6"/></button>
            </div>

            {/* 新增管理員區塊 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
              <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-3"><UserPlus className="w-4 h-4"/> 新增管理員</h4>
              <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3">
                <input type="text" placeholder="輸入帳號" required value={newAdminUser} onChange={e => setNewAdminUser(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg" />
                <input type="text" placeholder="設定密碼" required value={newAdminPass} onChange={e => setNewAdminPass(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg" />
                <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)} className="px-3 py-2 border rounded-lg bg-white">
                  <option value="admin">一般管理員</option>
                  <option value="super_admin">超級管理員</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">新增</button>
              </form>
            </div>

            {/* 管理員列表區塊 */}
            <div>
              <h4 className="font-bold text-gray-700 mb-3">現有帳號清單</h4>
              <div className="space-y-3">
                {adminList.map(admin => (
                  <div key={admin.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 text-xs rounded font-bold ${admin.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {admin.role === 'super_admin' ? '超級' : '一般'}
                      </div>
                      <span className="font-medium">{admin.username}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editingAdminId === admin.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" placeholder="新密碼" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="px-2 py-1 text-sm border rounded" autoFocus />
                          <button onClick={() => handleUpdatePassword(admin.id)} className="text-xs bg-emerald-500 text-white px-2 py-1 rounded">儲存</button>
                          <button onClick={() => {setEditingAdminId(null); setEditPassword('');}} className="text-xs bg-gray-200 px-2 py-1 rounded">取消</button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingAdminId(admin.id)} className="p-1.5 text-gray-400 hover:text-emerald-600 bg-gray-100 rounded-md" title="修改密碼">
                          <Edit className="w-4 h-4"/>
                        </button>
                      )}
                      
                      <button onClick={() => handleDeleteAdmin(admin.id)} className="p-1.5 text-gray-400 hover:text-rose-600 bg-gray-100 rounded-md" title="刪除帳號">
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
            <div className="bg-rose-500 p-4 flex justify-between items-center text-white"><div className="font-bold">價格較高，不作記錄</div><button onClick={() => setShowWarningModal(false)}><X className="w-6 h-6"/></button></div>
            <div className="p-6">
              <p className="mb-4">您輸入的 {warningDetails.newName} 價格為 <strong className="text-rose-600">${warningDetails.newPrice}</strong>。</p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6"><p className="text-sm text-gray-500">歷史最低價為：</p><div className="text-3xl font-black text-emerald-600 mb-2">${warningDetails.oldPrice}</div></div>
              <button onClick={() => setShowWarningModal(false)} className="w-full py-3 bg-gray-900 text-white rounded-xl">我知道了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}