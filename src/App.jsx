import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { Camera, Plus, Store, Tag, Calendar, AlertCircle, Image as ImageIcon, Trash2, X, DollarSign, CheckCircle2, Search, Lock, Unlock, Key } from 'lucide-react';

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
  
  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

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
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Auth Initialization
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

  // 2. Data Fetching (Public Path)
  useEffect(() => {
    if (!user || !db) return;
    
    // 使用公開路徑，讓所有人都能讀取同一份資料庫
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by timestamp descending
      fetchedItems.sort((a, b) => b.timestamp - a.timestamp);
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Image Compression
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        console.warn("圖片檔案過大，請選擇小於 5MB 的圖片。");
        return;
      }
      try {
        const compressedBase64 = await compressImage(file);
        setPhotoBase64(compressedBase64);
      } catch (error) {
        console.error("Image compression error", error);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setStore('');
    setDate(new Date().toISOString().split('T')[0]);
    setPhotoBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAdminAuth = (e) => {
    e.preventDefault();
    // 預設測試密碼為 admin123
    if (adminPassword === 'admin123') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassword('');
      setAdminLoginError('');
    } else {
      setAdminLoginError('密碼錯誤，請重新輸入。');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || !store || !date || !user || !db || !isAdmin) return;

    const numPrice = parseFloat(price);
    
    // Check for existing items (Case insensitive)
    const existingItem = items.find(i => i.name.trim().toLowerCase() === name.trim().toLowerCase());

    if (existingItem) {
      if (numPrice > existingItem.price) {
        // Trigger Warning Modal, Do NOT record
        setWarningDetails({
          newName: name,
          newPrice: numPrice,
          oldPrice: existingItem.price,
          oldStore: existingItem.store,
          oldDate: existingItem.date
        });
        setShowWarningModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'lowest_prices');
      let docRef;
      
      if (existingItem) {
        // Update the existing item to keep the ID, meaning we overwrite with the new lower price
        docRef = doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', existingItem.id);
      } else {
        // Create new
        docRef = doc(colRef);
      }

      await setDoc(docRef, {
        name: name.trim(),
        price: numPrice,
        store: store.trim(),
        date: date,
        photo: photoBase64,
        timestamp: Date.now()
      });

      setSuccessMessage(`已成功記錄 ${name.trim()} 的最低價：$${numPrice}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      resetForm();
    } catch (error) {
      console.error("Error saving document: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!user || !db || !isAdmin) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'lowest_prices', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Filter items based on search query
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.store.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 pb-20 md:pb-10 relative">
      {/* Header */}
      <header className="bg-emerald-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6" />
            <h1 className="text-xl font-bold">最低價記錄系統</h1>
          </div>
          
          {/* Admin Toggle */}
          <button 
            onClick={() => isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 rounded-full text-sm font-medium transition-colors"
          >
            {isAdmin ? (
              <><Unlock className="w-4 h-4" /> 登出管理員</>
            ) : (
              <><Lock className="w-4 h-4" /> 管理員登入</>
            )}
          </button>
        </div>
      </header>

      <main className={`max-w-4xl mx-auto p-4 md:p-6 grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : ''} gap-6 transition-all duration-300`}>
        
        {/* Left Column: Form (Only visible to Admin) */}
        {isAdmin && (
          <div className="md:col-span-1 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-5 sticky top-24 ring-1 ring-emerald-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-700">
                  <Plus className="w-5 h-5" /> 新增比價記錄
                </h2>
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-md font-bold">管理員模式</span>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">日期</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="date" 
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Item Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">物品名稱</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="例如：衛生紙 12入"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">價格</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      required
                      placeholder="輸入價格"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Store */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">商店名稱</label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      required
                      placeholder="例如：全聯、Costco"
                      value={store}
                      onChange={(e) => setStore(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">拍照 / 圖片 (可選)</label>
                  <div className="mt-1 flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden relative">
                      {photoBase64 ? (
                        <div className="w-full h-full relative group">
                          <img src={photoBase64} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-sm">點擊更換圖片</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Camera className="w-8 h-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">點擊上傳圖片</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>記錄最低價</>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Right/Main Column: List */}
        <div className={isAdmin ? "md:col-span-2" : "md:col-span-3 max-w-3xl mx-auto w-full"}>
          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2 animate-fade-in-down">
              <CheckCircle2 className="w-5 h-5" />
              {successMessage}
            </div>
          )}

          {!isAdmin && (
             <div className="mb-6 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
               <p className="text-sm">
                 目前為<strong>公開檢視模式</strong>。您可以在此搜尋並查看所有物品的最低價紀錄。若需新增或修改紀錄，請點擊右上方登入管理員。
               </p>
             </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">所有最低價清單</h2>
            <span className="text-sm text-gray-500 bg-gray-200 px-3 py-1 rounded-full">共 {filteredItems.length} 筆</span>
          </div>

          {/* Search Bar */}
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋物品名稱或商店..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 flex flex-col items-center justify-center text-gray-400">
              <ImageIcon className="w-16 h-16 mb-3 opacity-50" />
              <p>目前還沒有任何記錄</p>
              {isAdmin && <p className="text-sm mt-1">在左側表單新增你的第一筆最低價吧！</p>}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 flex flex-col items-center justify-center text-gray-400">
              <Search className="w-12 h-12 mb-3 text-gray-300" />
              <p>找不到符合「{searchQuery}」的記錄</p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col group transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-gray-800 break-all">{item.name}</h3>
                    {/* Delete button only visible to Admin */}
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                        title="刪除記錄"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-4 mb-3">
                    {item.photo ? (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="text-2xl font-black text-emerald-600 mb-1">
                        ${item.price.toFixed(2)}
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mb-1 gap-1">
                        <Store className="w-3 h-3" />
                        <span className="truncate">{item.store}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-400 gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.date}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-800 mb-2">管理員登入</h3>
              <p className="text-sm text-gray-500 text-center mb-6">請輸入密碼以解鎖新增與刪除權限。<br/>(測試密碼: admin123)</p>
              
              <form onSubmit={handleAdminAuth}>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="輸入密碼..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none mb-2"
                  autoFocus
                />
                {adminLoginError && (
                  <p className="text-rose-500 text-sm mb-4">{adminLoginError}</p>
                )}
                
                <div className="flex gap-3 mt-6">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAdminLogin(false);
                      setAdminLoginError('');
                      setAdminPassword('');
                    }}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                  >
                    登入
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Custom Warning Modal (For Higher Prices) */}
      {showWarningModal && warningDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all">
            <div className="bg-rose-500 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2 font-bold text-lg">
                <AlertCircle className="w-6 h-6" />
                價格較高，不作記錄
              </div>
              <button onClick={() => setShowWarningModal(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                您輸入的 <strong className="text-gray-900">{warningDetails.newName}</strong> 價格為 <strong className="text-rose-600">${warningDetails.newPrice}</strong>。
              </p>
              
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-6">
                <p className="text-sm text-gray-500 mb-1">系統內的歷史最低價為：</p>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-3xl font-black text-emerald-600">${warningDetails.oldPrice}</span>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Store className="w-4 h-4" /> {warningDetails.oldStore} 
                  <span className="text-gray-300">|</span> 
                  <Calendar className="w-4 h-4" /> {warningDetails.oldDate}
                </div>
              </div>
              
              <button 
                onClick={() => setShowWarningModal(false)}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-colors"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}