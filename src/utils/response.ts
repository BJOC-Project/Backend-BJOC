export const success = (res: any, data: any) => {
  res.json({
    success: true,
    data
  });
};

export const error = (res: any, message: string) => {
  res.status(500).json({
    success: false,
    message
  });
};