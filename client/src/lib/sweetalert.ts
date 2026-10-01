type SweetAlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

type SweetAlertResult = { isConfirmed?: boolean; isDismissed?: boolean };

type SweetAlertOptions = {
  title?: string;
  text?: string;
  html?: string;
  icon?: SweetAlertIcon;
  toast?: boolean;
  position?: string;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  timer?: number;
  timerProgressBar?: boolean;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
};

type SweetAlertApi = {
  fire: (options: SweetAlertOptions) => Promise<SweetAlertResult>;
};

declare global {
  interface Window {
    Swal?: SweetAlertApi;
  }
}

const BLUE = '#2563eb';
const RED = '#dc2626';
const SLATE = '#64748b';

function swal() {
  return typeof window !== 'undefined' ? window.Swal : undefined;
}

export async function confirmAction(
  title: string,
  text: string,
  confirmButtonText = 'Yes, continue',
  icon: SweetAlertIcon = 'warning',
): Promise<boolean> {
  const api = swal();
  if (!api) return window.confirm(`${title}\n\n${text}`);
  const result = await api.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: icon === 'warning' || icon === 'error' ? RED : BLUE,
    cancelButtonColor: SLATE,
    allowOutsideClick: false,
  });
  return Boolean(result.isConfirmed);
}

export async function showToast(message: string, icon: SweetAlertIcon = 'success') {
  const api = swal();
  if (!api) return;
  await api.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
  });
}

export async function showError(message: string, title = 'Something went wrong') {
  const api = swal();
  if (!api) {
    window.alert(message);
    return;
  }
  await api.fire({
    title,
    text: message,
    icon: 'error',
    confirmButtonText: 'OK',
    confirmButtonColor: BLUE,
  });
}

export async function showInfo(title: string, message: string) {
  const api = swal();
  if (!api) {
    window.alert(message);
    return;
  }
  await api.fire({
    title,
    text: message,
    icon: 'info',
    confirmButtonText: 'Got it',
    confirmButtonColor: BLUE,
  });
}
