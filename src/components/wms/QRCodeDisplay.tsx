import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { Pallet } from "@shared/types";
import zenithLogo from "@/assets/zenith-logo.svg";

interface QRCodeProps {
  value: string;
  size?: number;
  showDownload?: boolean;
  showPrint?: boolean;
  palletData?: Pallet;
}

export function QRCodeDisplay({ value, size = 200, showDownload = false, showPrint = false, palletData }: QRCodeProps) {
  // Simple QR code placeholder using data URL with text
  // In production, you would use a proper QR code library or API
  const generateQRCodeDataURL = (text: string) => {
    // Create a simple visual representation
    // This is a placeholder - in production use qrcode library or API
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = size;
    canvas.height = size;
    
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    
    // Black border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    
    // Create a simple pattern (not a real QR code)
    const cellSize = (size - 40) / 10;
    ctx.fillStyle = '#000000';
    
    // Generate pseudo-random pattern based on text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const seed = (hash + x * 17 + y * 31) % 100;
        if (seed > 50) {
          ctx.fillRect(20 + x * cellSize, 20 + y * cellSize, cellSize - 2, cellSize - 2);
        }
      }
    }
    
    // Add text label below
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, size / 2, size - 5);
    
    return canvas.toDataURL();
  };

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = `qr-${value}.png`;
    link.href = generateQRCodeDataURL(value);
    link.click();
  };

  const printQRCode = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const qrDataURL = generateQRCodeDataURL(value);
    
    // Inline SVG logo
    const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" fill="none" class="logo">
      <path d="M10 15 L40 15 L10 35 L40 35" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <g transform="translate(50, 10)">
        <path d="M0 15 L12 5 L24 15 L24 35 L0 35 Z" stroke="currentColor" stroke-width="2" fill="none"/>
        <rect x="6" y="20" width="5" height="8" fill="currentColor"/>
        <rect x="13" y="20" width="5" height="8" fill="currentColor"/>
        <line x1="0" y1="15" x2="24" y2="15" stroke="currentColor" stroke-width="2"/>
      </g>
      <text x="85" y="28" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="currentColor">ZENITH</text>
      <text x="85" y="45" font-family="Arial, sans-serif" font-size="12" font-weight="normal" fill="currentColor" opacity="0.7">Warehouse Management</text>
    </svg>`;
    
    // Build compact product list HTML
    let productsHTML = '';
    if (palletData && palletData.products.length > 0) {
      productsHTML = `
        <div class="products-section">
          <div class="products-header">Products (${palletData.products.length}):</div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              ${palletData.products.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.id}</td>
                  <td>${p.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Pallet Label - ${value}</title>
          <style>
            @media print {
              @page {
                size: 4in 6in;
                margin: 0.15in;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .container {
              text-align: center;
              border: 2px solid #000;
              padding: 8px;
              background: white;
              width: 100%;
              max-width: 4in;
              margin: 0 auto;
            }
            h1 {
              font-size: 16px;
              margin: 0 0 2px 0;
              font-weight: bold;
            }
            .logo {
              width: 80px;
              height: auto;
              margin: 0 auto 4px;
              display: block;
            }
            .subtitle {
              font-size: 8px;
              color: #666;
              margin-bottom: 4px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 3px;
              text-align: left;
              margin: 4px 0;
              font-size: 7px;
              border: 1px solid #ddd;
              padding: 4px;
              background: #f9f9f9;
            }
            .info-item {
              display: flex;
              flex-direction: column;
              line-height: 1.2;
            }
            .info-label {
              font-weight: bold;
              font-size: 6px;
              text-transform: uppercase;
              color: #666;
            }
            .info-value {
              font-size: 7px;
              color: #000;
              margin-top: 1px;
            }
            img {
              width: 120px;
              height: 120px;
              margin: 4px 0;
            }
            .id {
              font-size: 14px;
              font-weight: bold;
              font-family: monospace;
              margin: 4px 0;
              padding: 4px;
              background: #f0f0f0;
              border-radius: 2px;
              border: 1px solid #000;
            }
            .products-section {
              margin-top: 4px;
              text-align: left;
              max-height: 1.5in;
              overflow: hidden;
            }
            .products-header {
              font-size: 8px;
              font-weight: bold;
              margin-bottom: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 6px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 2px;
              text-align: left;
            }
            th {
              background: #f0f0f0;
              font-weight: bold;
              font-size: 6px;
            }
            td {
              font-size: 6px;
            }
            .instructions {
              margin-top: 4px;
              font-size: 6px;
              color: #666;
            }
            @media screen {
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 20px;
                background: #eee;
              }
              .container {
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .print-button {
                margin-top: 20px;
                padding: 12px 24px;
                font-size: 16px;
                background: #000;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
              }
              .print-button:hover {
                background: #333;
              }
            }
            @media print {
              .print-button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${logoSVG}
            <h1>PALLET LABEL</h1>
            
            ${palletData ? `
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Type</span>
                  <span class="info-value">${palletData.type}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Location</span>
                  <span class="info-value">${palletData.locationId}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Total Units</span>
                  <span class="info-value">${palletData.totalQuantity}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Created</span>
                  <span class="info-value">${new Date(palletData.createdDate).toLocaleDateString()}</span>
                </div>
                ${palletData.expiryDate ? `
                  <div class="info-item">
                    <span class="info-label">Expiry</span>
                    <span class="info-value">${new Date(palletData.expiryDate).toLocaleDateString()}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Months Left</span>
                    <span class="info-value">${palletData.monthsUntilExpiry || 'N/A'}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            
            <img src="${qrDataURL}" alt="QR Code for ${value}" />
            <div class="id">${value}</div>
            
            ${productsHTML}
            
            <div class="instructions">Scan QR code for details</div>
          </div>
          <button class="print-button" onclick="window.print()">Print Label</button>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  return (
    <Card className="inline-block">
      <CardContent className="p-4 space-y-2">
        <img 
          src={generateQRCodeDataURL(value)} 
          alt={`QR Code for ${value}`}
          className="mx-auto"
          style={{ width: size, height: size }}
        />
        {(showDownload || showPrint) && (
          <div className="flex gap-2">
            {showDownload && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={downloadQRCode}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
            {showPrint && (
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={printQRCode}
              >
                <Printer className="h-4 w-4" />
                Print Label
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
