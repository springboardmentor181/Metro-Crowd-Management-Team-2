import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import AppRoutes from '@/routes/AppRoutes';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer position="top-right" autoClose={3500} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="light" />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
