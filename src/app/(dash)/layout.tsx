import { Navbar } from '@/components/navbar'
import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <Sidebar />
      <div className="lg:pl-[260px]">
        <Navbar />
        <main className="px-4 pb-10 pt-4 lg:px-6">{children}</main>
      </div>
    </div>
  )
}
