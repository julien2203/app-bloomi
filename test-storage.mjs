   import { createClient } from '@supabase/supabase-js';

   const url = 'https://uzkrxkoussjnlyyykkul.supabase.co';
   const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6a3J4a291c3Nqbmx5eXlra3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzE1ODcsImV4cCI6MjA4NTk0NzU4N30.jajslRZRZoFaHu1wtVDONd7c-XeOPZTyimW_pGmgiCQ'; // même valeur que dans .env.local

   const supabase = createClient(url, key);

   const run = async () => {
     const { error } = await supabase.storage.from('listings').upload(
       'test/test.txt',
       new TextEncoder().encode('hello'),
       { contentType: 'text/plain', upsert: true }
     );
     console.log('error:', error);
   };

   run();