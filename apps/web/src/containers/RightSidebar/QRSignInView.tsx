import React from 'react';
import { QrCode } from 'lucide-react';
import { Button } from "@credopass/ui/components/button";

const QRSignInView: React.FC = () => {
  const handleQRScan = () => {
    // TODO: Implement QR code scanner logic
    console.log('Scanning QR code...');
  };

  const handleManualSignIn = () => {
    // TODO: Implement manual sign-in logic
    console.log('Manual sign-in...');
  };

  return (
    <div className="qr-signin-widget">
      <div className="qr-signin-content">
        <div className="qr-icon-container">
          <QrCode size={64} />
        </div>
        <h3>Scan QR or SignIn</h3>
        <p className="qr-description">
          Scan a QR code to check in or manually sign in
        </p>
        
        <div className="qr-signin-actions">
          <Button 
            onClick={handleQRScan}
            className="w-full"
          >
            Scan QR Code
          </Button>
          <Button 
            onClick={handleManualSignIn}
            variant="outline"
            className="w-full"
          >
            Manual Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QRSignInView;
