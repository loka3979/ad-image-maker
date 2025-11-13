// app/layout.tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <div className="fixed bottom-2 right-2 px-2 py-1 bg-black text-white z-[9999]">
          TW OK
        </div>
        {children}
      </body>
    </html>
  );
}
