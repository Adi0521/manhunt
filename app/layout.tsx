import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

import { ThemeProvider } from "@/components/theme-provider"

import { Toaster } from "@/components/ui/sonner"
import LocationPublisher from "@/components/LocationPublisher"

import { FaPlay, FaCog, FaRegUser } from "react-icons/fa";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


// Menu items.
const items = [
  {
    title: "Play",
    url: "#",
    icon: FaPlay,
  },
  {
    title: "Configure",
    url: "#",
    icon: FaCog,
  },
  {
    title: "User",
    url: "#",
    icon: FaRegUser,
  },
]

export const metadata: Metadata = {
  title: "Manhunt",
  description: "Manhunt web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-300 dark:bg-neutral-900`}
        style={{ overflowX: "hidden", width: "100vw", margin: 0, padding: 0 }}
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
          {children}
        </ThemeProvider>

        <LocationPublisher />
        <Toaster />
{/* 
        <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Idli Manhunt</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider> */}
      </body>
    </html>
  );
}
