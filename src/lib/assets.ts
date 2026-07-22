const VEHICLE_IMAGE_MAP: Record<string, string> = {
  'Dravia Dustera': '/cars/Dravia Dustera.png',
  'Dravia Nova': '/cars/Dravia Nova.png',
  'Bervik M4R': '/cars/Bervik M4R.png',
  'Bervik X8': '/cars/Bervik X8.png',
  'Auron Q8X': '/cars/Auron Q8X.png',
  'Auron RS7': '/cars/Auron RS7.png',
  'Ferano F8R': '/cars/Ferano F8R.png',
  'Ferano Roma X': '/cars/Ferano Roma X.png',
  'Vortek 911R': '/cars/Vortek 911R.png',
  'Vortek Cayenne X': '/cars/Vortek Cayenne X.png',
};

const CLOTHING_IMAGE_MAP: Record<string, string> = {
  'Adibas Sport Tee': '/Clothes/tshirt/Adibas Sport Tee.png',
  'Balencii Oversize Tee': '/Clothes/tshirt/Balencii Oversize Tee.png',
  'Guci Monogram Tee': '/Clothes/tshirt/Guci Monogram Tee.png',
  'Like Basic Tee': '/Clothes/tshirt/Like Basic Tee.png',
  'Stone Ilan Patch Tee': '/Clothes/tshirt/Stone Ilan Patch Tee.png',
  'Adibas Stripe Pants': '/Clothes/pants/Adibas Stripe Pants.png',
  'Balencii Baggy Pants': '/Clothes/pants/Balencii Baggy Pants.png',
  'Levios Urban Jeans': '/Clothes/pants/Levios Urban Jeans.png',
  'Like Track Pants': '/Clothes/pants/Like Track Pants.png',
  'Stone Ilan Cargo Pants': '/Clothes/pants/Stone Ilan Cargo Pants.png',
  'Adibas Ultra Move': '/Clothes/shoes/Adibas Ultra Move.png',
  'Convoy Classic High': '/Clothes/shoes/Convoy Classic High.png',
  'Like Air Run': '/Clothes/shoes/Like Air Run.png',
  'Luma Street Rider': '/Clothes/shoes/Luma Street Rider.png',
  'Niu Balanse 550': '/Clothes/shoes/Niu Balanse 550.png',
};

export function getVehicleImagePath(name: string): string {
  return VEHICLE_IMAGE_MAP[name] ?? '/cars/Dravia Nova.png';
}

export function getClothingImagePath(name: string): string {
  return CLOTHING_IMAGE_MAP[name] ?? '/Clothes/tshirt/Like Basic Tee.png';
}
