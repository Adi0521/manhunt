import { getUsers } from "../utils/supabase-auth";

import UserList from "./userList";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    async function clientFetchUsers() {
        try {
            const userListFinal = await getUsers();
            return userListFinal;
        } catch (error) {
            console.error(error);
            return [];
        }
    }

    let users = await clientFetchUsers();


    return (
        <>

            <div className="w-full bg-slate-800 dark:bg-[rgb(20,77,128)] text-white h-10 absolute t-0">
                <h1 className="absolute l-0 m-2">Manhunt • ADMIN</h1>
                
            </div>
            <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-stone-300 dark:bg-neutral-900">
                <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">

                <UserList users={users || []} />

                </main>
                <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
                
                </footer>
            </div>
        </>
    );
}

