// const getsMessagesPipeline = (chat) => {
//   if (chat) {
//     return (
//       [
//         {
//           $lookup: {
//             from: 'message',
//             let: { id: "$_id" },
//             pipeline: [
//               {
//                 $match: {
//                   productColor: colors,
//                   $expr: { $eq: ["$productId", "$$id"] }
//                 }
//               }
//             ],
//             as: 'images'
//           }
//         }
//       ]
//     );
//   }

//   return (
//     [
//       {
//         $lookup: {
//           from: 'images',
//           localField: '_id',
//           foreignField: 'productId',
//           as: 'images'
//         }
//       }
//     ]
//   );
// };
