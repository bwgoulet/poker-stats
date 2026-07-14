import './globals.css'; import { AppShell } from '@/components/layout/AppShell';
export const metadata={title:'Poker Tracker',description:'Poker league statistics'}; export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AppShell>{children}</AppShell></body></html>}
