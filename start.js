import {mountInstaller} from './app.js?v=library-20261114';

mountInstaller().catch(error=>{
  const status=document.getElementById('connect-status');
  status.textContent=`Could not open the collection: ${error.message}. Reload to try again.`;
  status.dataset.error='true';
});
