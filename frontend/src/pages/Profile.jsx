/**
 * pages/Profile.jsx
 *
 * User profile page showing account details and logout option.
 */

import { useAuth } from '../hooks/useAuth';
import Layout from '../components/layout/Layout';
import Avatar from '../components/ui/Avatar';
import { LogOut, Mail, User } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Profile</h1>
          <p className="text-zinc-400 mt-1">Manage your account details and preferences.</p>
        </header>

        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 border-b border-zinc-800/50 pb-8 mb-8">
            <Avatar name={user?.name} color={user?.avatar_color} size="xl" className="ring-4 ring-zinc-800/50" />
            
            <div className="text-center md:text-left space-y-3 flex-1">
              <div>
                <h2 className="text-xl font-bold text-white">{user?.name}</h2>
                <p className="text-zinc-400 text-sm mt-0.5">Active Member</p>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 md:gap-6 text-sm text-zinc-300">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <User className="w-4 h-4 text-zinc-500" />
                  <span>{user?.name}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Mail className="w-4 h-4 text-zinc-500" />
                  <span>{user?.email}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center md:justify-start">
            <button 
              onClick={logout} 
              className="btn-secondary text-danger-400 hover:bg-danger-500/10 hover:border-danger-500/30 w-full md:w-auto"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
