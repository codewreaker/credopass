import React, { useState } from 'react';
import { TopNavBar } from './components/TopNavBar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { HeroPanel } from './components/HeroPanel';
import { AttendanceTable } from './components/AttendanceTable';
import { SignInModal } from './components/SignInModal';
import './App.css';

import { useLiveQuery } from '@tanstack/react-db'
import { userCollection } from './collections/user';
import { User } from './entities/user';
import type { UserType } from './entities/schemas';



function App() {
  const [activeMode, setActiveMode] = useState('dashboard');
  const [showSignInModal, setShowSignInModal] = useState(false);

    const { data } = useLiveQuery(q => q.from({ userCollection }))

  const createUser = () => {
    const user = new User('Israel', 'Agyeman-Prmepeh', `user${crypto.randomUUID()}@email.com`, '+563456765');
    user.validate();
    console.log('user', user.loyaltyTier);
    userCollection.insert(user)
  }

  const rows: UserType[] = Array.isArray(data) ? data : [];

  return (
    <div className="app-container">
      <TopNavBar onNewEventClick={() => setShowSignInModal(true)} />
      
      <div className="app-layout">
        <LeftSidebar activeMode={activeMode} onModeChange={setActiveMode} />
        
        <main className="main-content">
          {activeMode === 'dashboard' && (
            <>
              <HeroPanel />
              <AttendanceTable rowData={rows} />
            </>
          )}
          
          {activeMode === 'members' && (
            <div className="placeholder-content">
              <h2>Members Management</h2>
              <p>Member management interface coming soon...</p>
            </div>
          )}
          
          {activeMode === 'events' && (
            <div className="placeholder-content">
              <h2>Events Calendar</h2>
              <p>Events management interface coming soon...</p>
            </div>
          )}
          
          {activeMode === 'analytics' && (
            <div className="placeholder-content">
              <h2>Analytics Dashboard</h2>
              <p>Advanced analytics coming soon...</p>
            </div>
          )}
          
          {activeMode === 'reports' && (
            <div className="placeholder-content">
              <h2>Reports</h2>
              <p>Reporting interface coming soon...</p>
            </div>
          )}
          
          {activeMode === 'settings' && (
            <div className="placeholder-content">
              <h2>Settings</h2>
              <p>Application settings coming soon...</p>
            </div>
          )}
        </main>
        
        <RightSidebar />
      </div>
      
      <SignInModal 
        isOpen={showSignInModal} 
        onClose={() => setShowSignInModal(false)} 
      />
    </div>
  );
}

export default App;
