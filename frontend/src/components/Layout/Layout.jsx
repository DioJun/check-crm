import Sidebar from './Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 flex-1 overflow-x-auto pt-16 lg:pt-0">
        <div className="p-6 lg:p-8 min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
